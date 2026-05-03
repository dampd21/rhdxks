/* ================================================================
   Sherpain21 — community-images-api.js
   Cloudflare Images upload endpoint for community editor.

   사용 방법
   1) worker/src/index.js 상단에 import 추가
      import { createCommunityImagesModule } from './community-images-api.js';

   2) fetch handler 바깥에서 모듈 생성
      const communityImagesModule = createCommunityImagesModule({
        jsonResp,
        requireAuth,
      });

   3) 라우팅 분기 추가
      if (pathname === '/api/community/images' && request.method === 'POST') {
        return communityImagesModule.handleUpload(request, env);
      }

   필요 환경 변수/시크릿
   - CF_IMAGES_ACCOUNT_ID  (권장 var)
   - CF_IMAGES_API_TOKEN   (권장 secret)

   선택 환경 변수
   - CF_IMAGES_DELIVERY_PREFIX
     예) https://imagedelivery.net/ACCOUNT_HASH
   ================================================================ */

export function createCommunityImagesModule(deps) {
  const jsonResp = deps.jsonResp;
  const requireAuth = deps.requireAuth;

  async function handleUpload(request, env) {
    const payload = await requireAuth(request, env);
    if (!payload) return jsonResp({ ok: false, error: 'Unauthorized' }, 401);

    const accountId = env.CF_IMAGES_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || '';
    const apiToken = env.CF_IMAGES_API_TOKEN || '';

    if (!accountId || !apiToken) {
      return jsonResp({
        ok: false,
        error: 'Cloudflare Images 환경변수가 설정되지 않았습니다. (CF_IMAGES_ACCOUNT_ID / CF_IMAGES_API_TOKEN)'
      }, 500);
    }

    let form;
    try {
      form = await request.formData();
    } catch (e) {
      return jsonResp({ ok: false, error: 'multipart/form-data 형식이 아닙니다.' }, 400);
    }

    const file = form.get('file');
    if (!file) return jsonResp({ ok: false, error: 'file required' }, 400);
    if (typeof file === 'string') return jsonResp({ ok: false, error: 'invalid file' }, 400);

    const mime = String(file.type || '');
    if (!mime.startsWith('image/')) {
      return jsonResp({ ok: false, error: '이미지 파일만 업로드할 수 있습니다.' }, 400);
    }

    if (file.size > 10 * 1024 * 1024) {
      return jsonResp({ ok: false, error: '이미지 용량은 10MB 이하만 허용합니다.' }, 400);
    }

    const uploadForm = new FormData();
    uploadForm.append('file', file, file.name || 'image');
    uploadForm.append('metadata', JSON.stringify({
      uploader: payload.sub,
      source: 'community',
      uploadedAt: new Date().toISOString()
    }));
    uploadForm.append('requireSignedURLs', 'false');

    try {
      const response = await fetch('https://api.cloudflare.com/client/v4/accounts/' + accountId + '/images/v1', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiToken
        },
        body: uploadForm
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return jsonResp({
          ok: false,
          error: (data.errors && data.errors[0] && data.errors[0].message) || 'Cloudflare Images 업로드 실패',
          detail: data
        }, 502);
      }

      const result = data.result || {};
      let url = '';

      if (Array.isArray(result.variants) && result.variants.length > 0) {
        url = result.variants[0];
      } else if (env.CF_IMAGES_DELIVERY_PREFIX && result.id) {
        url = String(env.CF_IMAGES_DELIVERY_PREFIX).replace(/\/$/, '') + '/' + result.id + '/public';
      }

      return jsonResp({
        ok: true,
        image: {
          id: result.id || '',
          filename: result.filename || file.name || 'image',
          uploaded: result.uploaded || new Date().toISOString(),
          requireSignedURLs: !!result.requireSignedURLs,
          variants: result.variants || [],
          width: result.meta && result.meta.width ? result.meta.width : null,
          height: result.meta && result.meta.height ? result.meta.height : null,
          url: url
        }
      });
    } catch (e) {
      return jsonResp({ ok: false, error: e.message || 'Cloudflare Images upload failed' }, 500);
    }
  }

  return {
    handleUpload
  };
}
