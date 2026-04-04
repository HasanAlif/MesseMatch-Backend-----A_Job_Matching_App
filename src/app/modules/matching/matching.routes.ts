import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { matchingController } from './matching.controller';
import { UserRole } from '../../models';

const router = express.Router();



export const matchingRoutes = router;