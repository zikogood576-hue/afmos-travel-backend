import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middlewares/auth.js';
import { badRequest } from '../../utils/errors.js';
import { submitTravelAsTechnician } from './travels.service.js';

export const travelsRouter = Router();

const createSchema = z.object({
  departureCityId: z.string().uuid(),
  destinationCityId: z.string().uuid(),
  missionDate: z.string().min(8), // YYYY-MM-DD (validation stricte possible plus tard)
  comments: z.string().max(2000).optional(),

  // GPS du technicien au moment de la soumission (obligatoire pour anti-fraude)
  submissionLat: z.coerce.number(),
  submissionLon: z.coerce.number(),

  // Repas du conducteur
  lunchSelected: z.boolean().optional().default(false),
  dinnerSelected: z.boolean().optional().default(false),

  colleagues: z
    .array(
      z.object({
        userId: z.string().uuid(),
        lunchSelected: z.boolean().optional().default(false),
        dinnerSelected: z.boolean().optional().default(false)
      })
    )
    .optional()
    .default([])
});

// Crée et SOUMET une déclaration (status Pending validation)
travelsRouter.post('/', requireAuth, requireRole('TECHNICIAN'), async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Payload invalide', 'VALIDATION_ERROR');

    const result = await submitTravelAsTechnician({
      creatorUserId: req.auth.userId,
      payload: parsed.data
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

