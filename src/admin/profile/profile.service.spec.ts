import { ProfileService } from './profile.service';
import { MAX_AVATAR_SIZE } from '../../uploads/uploads.service';
import { ApiException } from '../../common/exceptions/api-exception';
import { User, USER_ROLES } from '../../users/entities/user.entity';

describe('ProfileService avatar upload', () => {
  let service: ProfileService;
  let mockDataSource: {
    transaction: jest.Mock;
  };
  let mockUsersService: {
    findById: jest.Mock;
  };
  let mockAudit: {
    record: jest.Mock;
  };
  let mockAdminUsers: Record<string, unknown>;
  let mockUploadsService: {
    storeAttachment: jest.Mock;
    storeBuffer: jest.Mock;
  };

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'user@example.com',
    passwordHash: 'hash',
    displayName: 'Test User',
    bio: null,
    avatarUrl: null,
    role: USER_ROLES.CONTRIBUTOR,
    accessStatus: 'active',
    displayPrefs: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    mockDataSource = {
      transaction: jest.fn(
        async (cb: (manager: unknown) => Promise<unknown>) => {
          const mockManager = {
            getRepository: () => ({
              update: jest.fn().mockResolvedValue({ affected: 1 }),
            }),
          };
          return cb(mockManager);
        },
      ),
    };
    mockUsersService = {
      findById: jest.fn().mockResolvedValue({ ...mockUser }),
    };
    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    mockAdminUsers = {};
    mockUploadsService = {
      storeAttachment: jest.fn().mockResolvedValue({
        url: '/api/v1/uploads/files/2026/09/avatar.png',
        mime_type: 'image/png',
        size: 1024,
        original_name: 'test.png',
        stored_path: '/tmp/avatar.png',
      }),
      storeBuffer: jest.fn().mockResolvedValue({
        url: '/api/v1/uploads/files/2026/09/avatar.png',
        mime_type: 'image/png',
        size: 1024,
        original_name: 'avatar.png',
        stored_path: '/tmp/avatar.png',
      }),
    };

    service = new ProfileService(
      mockDataSource as never,
      mockUsersService as never,
      mockAudit as never,
      mockAdminUsers as never,
      mockUploadsService as never,
    );
  });

  it('rejects multipart file exceeding 5MB limit', async () => {
    const file = {
      originalname: 'huge.png',
      mimetype: 'image/png',
      size: MAX_AVATAR_SIZE + 1,
      path: '/tmp/huge.png',
    } as Express.Multer.File;

    await expect(
      service.updateAvatar({
        userId: 'user-uuid-1',
        file,
      }),
    ).rejects.toThrow(ApiException);
  });

  it('rejects non-image file type', async () => {
    const file = {
      originalname: 'document.pdf',
      mimetype: 'application/pdf',
      size: 1000,
      path: '/tmp/document.pdf',
    } as Express.Multer.File;

    await expect(
      service.updateAvatar({
        userId: 'user-uuid-1',
        file,
      }),
    ).rejects.toThrow(ApiException);
  });

  it('stores valid multipart image and updates avatarUrl in DB', async () => {
    const file = {
      originalname: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: 2 * 1024 * 1024,
      path: '/tmp/photo.jpg',
    } as Express.Multer.File;

    await service.updateAvatar({
      userId: 'user-uuid-1',
      file,
    });

    expect(mockUploadsService.storeAttachment).toHaveBeenCalledWith({
      originalname: 'photo.jpg',
      mimetype: 'image/jpeg',
      size: 2 * 1024 * 1024,
      path: '/tmp/photo.jpg',
    });
    expect(mockDataSource.transaction).toHaveBeenCalled();
  });

  it('stores valid base64 dataUrl and updates avatarUrl in DB', async () => {
    const base64Data = Buffer.from('fake-image-bytes').toString('base64');
    const dataUrl = `data:image/png;base64,${base64Data}`;

    await service.updateAvatar({
      userId: 'user-uuid-1',
      dataUrl,
    });

    expect(mockUploadsService.storeBuffer).toHaveBeenCalled();
    expect(mockDataSource.transaction).toHaveBeenCalled();
  });
});
