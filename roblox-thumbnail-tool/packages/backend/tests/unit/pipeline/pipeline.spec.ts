// =============================================================================
// tests/unit/pipeline/pipeline.spec.ts — Pipeline Orchestrator Tests
// =============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockDownloadImage = jest.fn<any>();
const mockValidateImage = jest.fn<any>();
const mockCalculatePHash = jest.fn<any>();
const mockProcessImage = jest.fn<any>();

jest.mock('../../../src/pipeline/downloader', () => ({
  downloadImage: mockDownloadImage,
}));

jest.mock('../../../src/pipeline/validator', () => ({
  validateImage: mockValidateImage,
}));

jest.mock('../../../src/pipeline/hasher', () => ({
  calculatePHash: mockCalculatePHash,
}));

jest.mock('../../../src/pipeline/resizer', () => ({
  processImage: mockProcessImage,
}));

jest.mock('@observability/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}));

jest.mock('@config/env', () => ({
  env: {
    ENABLE_DEDUPLICATION: true,
  }
}));

const mockFindFirst = jest.fn<any>();
jest.mock('@database/client', () => ({
  db: {
    thumbnail: {
      findFirst: mockFindFirst,
    }
  }
}));

import { runPipeline } from '../../../src/pipeline/pipeline';

describe('runPipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('downloads, validates, resizes, and hashes successfully', async () => {
    mockDownloadImage.mockResolvedValue(Buffer.from('fake-image-data'));
    mockValidateImage.mockResolvedValue({ isValid: true, metadata: {} });
    mockProcessImage.mockResolvedValue({
      buffer: Buffer.from('processed'),
      width: 100,
      height: 100,
      format: 'png',
      sizeKb: 10,
    });
    mockCalculatePHash.mockResolvedValue('fake-phash');
    mockFindFirst.mockResolvedValue(null);

    const result = await runPipeline('http://example.com/image.png', { userId: 123 });

    expect(result.status).toBe('success');
    expect(result.pHash).toBe('fake-phash');
    expect(result.isDuplicate).toBe(false);
    expect(result.image?.width).toBe(100);
    
    expect(mockDownloadImage).toHaveBeenCalledWith('http://example.com/image.png');
    expect(mockValidateImage).toHaveBeenCalled();
    expect(mockProcessImage).toHaveBeenCalled();
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { userId: 123, pHash: 'fake-phash' },
      select: { id: true }
    });
  });

  it('returns error if validation fails', async () => {
    mockDownloadImage.mockResolvedValue(Buffer.from('fake-image-data'));
    mockValidateImage.mockResolvedValue({ isValid: false, error: 'Too small' });

    const result = await runPipeline('http://example.com/image.png');

    expect(result.status).toBe('error');
    expect(result.reason).toBe('Too small');
    expect(mockProcessImage).not.toHaveBeenCalled();
  });

  it('marks as duplicate if hash exists for user', async () => {
    mockDownloadImage.mockResolvedValue(Buffer.from('fake-image-data'));
    mockValidateImage.mockResolvedValue({ isValid: true, metadata: {} });
    mockProcessImage.mockResolvedValue({
      buffer: Buffer.from('processed'),
      width: 100,
      height: 100,
      format: 'png',
      sizeKb: 10,
    });
    mockCalculatePHash.mockResolvedValue('fake-phash');
    mockFindFirst.mockResolvedValue({ id: 'existing-id' });

    const result = await runPipeline('http://example.com/image.png', { userId: 123 });

    expect(result.status).toBe('success');
    expect(result.isDuplicate).toBe(true);
  });
});
