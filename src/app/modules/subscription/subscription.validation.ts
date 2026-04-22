import { z } from "zod";
import { Plan } from "../../models";

const updatePlanSchema = z.object({
  plan: z.nativeEnum(Plan, {
    errorMap: () => ({
      message:
        "Invalid plan. Choose from: FREE, PREMIUM_DE, PREMIUM_EU, LAUNCH_PREMIUM, BASIC, PREMIUM",
    }),
  }),
});

export const subscriptionValidation = {
  updatePlanSchema,
};
