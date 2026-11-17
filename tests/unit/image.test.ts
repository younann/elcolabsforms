// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { compressImage, UNSUPPORTED_IMAGE } from '../../src/lib/image';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubCanvas() {
  const canvases: HTMLCanvasElement[] = [];
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const el = create(tag);
    if (tag === 'canvas') canvases.push(el as HTMLCanvasElement);
    return el;
  }) as typeof document.createElement);
  const draw = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {}, drawImage: draw, fillStyle: '' } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob(['x'], { type: 'image/jpeg' })));
  return { canvases, draw };
}

describe('compressImage', () => {
  test('undecodable files (HEIC on Chrome) give a Hebrew error', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new DOMException('The source image could not be decoded.')));
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        decoding = '';
        decode() {
          return Promise.reject(new DOMException('EncodingError'));
        }
      },
    );
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }));
    const heic = new File([new Uint8Array([0, 0, 0, 24])], 'IMG_1.HEIC', { type: 'image/heic' });
    await expect(compressImage(heic)).rejects.toThrow(UNSUPPORTED_IMAGE);
    expect(UNSUPPORTED_IMAGE).toBe('פורמט התמונה אינו נתמך (HEIC). צלם מחדש או בחר JPEG');
  });

  test('downscales with createImageBitmap resize and frees the canvas', async () => {
    const close = vi.fn();
    const cib = vi
      .fn()
      .mockResolvedValueOnce({ width: 4000, height: 3000, close })
      .mockResolvedValueOnce({ width: 1600, height: 1200, close });
    vi.stubGlobal('createImageBitmap', cib);
    const { canvases, draw } = stubCanvas();
    const out = await compressImage(new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    expect(out.type).toBe('image/jpeg');
    expect(cib.mock.calls[0][1]).toMatchObject({ imageOrientation: 'from-image' });
    expect(cib.mock.calls[1][1]).toMatchObject({ resizeWidth: 1600, resizeHeight: 1200 });
    expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200);
    expect(canvases[0].width).toBe(0);
    expect(canvases[0].height).toBe(0);
    expect(close).toHaveBeenCalledTimes(2);
  });

  test('small images are not upscaled', async () => {
    const cib = vi.fn().mockResolvedValue({ width: 800, height: 600, close() {} });
    vi.stubGlobal('createImageBitmap', cib);
    const { draw } = stubCanvas();
    await compressImage(new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    expect(cib).toHaveBeenCalledOnce();
    expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 800, 600);
  });
});
