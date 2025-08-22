import { Router } from 'express';
import { AuthController } from './auth.controller';
import { AuthMiddleware } from './auth.middleware';
import { validateRequest, userRegistrationSchema, userLoginSchema } from '../../utils/validation';

const router = Router();
const authController = new AuthController();
const authMiddleware = new AuthMiddleware();

router.post('/register', validateRequest(userRegistrationSchema), authController.register);
router.post('/login', validateRequest(userLoginSchema), authController.login);
router.get('/profile', authMiddleware.authenticate, authController.getProfile);
router.post('/logout', authMiddleware.authenticate, authController.logout);

export default router;
