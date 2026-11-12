const ImageKit = require('@imagekit/nodejs');

const privateKey = (process.env.IMAGEKIT_PRIVATE_KEY || '').trim();
const publicKey = (process.env.IMAGEKIT_PUBLIC_KEY || '').trim();
const urlEndpoint = (process.env.IMAGEKIT_URL_ENDPOINT || '').trim();

let imagekit = null;
if (privateKey) {
  try {
    imagekit = new ImageKit({
      publicKey,
      privateKey,
      urlEndpoint,
    });
  } catch (err) {
    console.warn('[ImageKit] Failed to initialize ImageKit SDK cleanly. Running in degraded/mock media mode:', err.message);
    imagekit = null;
  }
} else {
  console.warn('[ImageKit] IMAGEKIT_PRIVATE_KEY is not configured. Running in degraded/mock media mode.');
}

module.exports = imagekit;
