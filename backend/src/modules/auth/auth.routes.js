import { Router } from 'express';
import { z } from 'zod';
import { loginWithAccessCode } from './auth.service.js';
import { badRequest } from '../../utils/errors.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = z
      .object({
        username: z.string().min(2),
        accessCode: z.string().min(4)
      })
      .safeParse(req.body);
    if (!body.success) throw badRequest('Payload invalide', 'VALIDATION_ERROR');

    const result = await loginWithAccessCode(body.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

