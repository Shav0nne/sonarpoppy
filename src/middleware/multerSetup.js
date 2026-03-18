import multer from 'multer';

const storage = multer.memoryStorage();

export const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
    fileFilter: (req, file, cb) => {
        // accept common image types only
        if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) return cb(null, true);
        cb(new Error('Unsupported file type'), false);
    }
});
