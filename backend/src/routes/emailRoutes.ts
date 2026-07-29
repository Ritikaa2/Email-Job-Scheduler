import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { EmailController } from '../controllers/emailController';
import { authMiddleware } from '../middlewares/auth';
import { validate } from '../middlewares/validation';

const upload = multer({ storage: multer.memoryStorage() });

const scheduleSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z.array(z.string().email('Invalid email format')).min(1, 'At least one recipient is required'),
  startTime: z.string().datetime({ message: 'Must be a valid ISO datetime string' }),
  delayBetweenEmailsMs: z.number().nonnegative().optional(),
  maxEmailsPerHour: z.number().positive().optional(),
  senderId: z.string().optional(),
});

const router = Router();

router.use(authMiddleware);

router.post('/schedule', validate(scheduleSchema), EmailController.schedule);
router.get('/queue-status', EmailController.getQueueStatus);
router.get('/scheduled', EmailController.getScheduled);
router.get('/sent', EmailController.getSent);
router.post('/upload-recipients', upload.single('file'), EmailController.uploadRecipients);

export default router;

