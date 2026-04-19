import { z } from "zod";
import { ContentType } from "./appContent.model";

const updateSchema = z.object({
  body: z.object({
    content: z
      .string({
        required_error: "Content is required",
      })
      .min(1, "Content cannot be empty")
      .trim(),
  }),
  params: z.object({
    type: z.enum(
      [
        ContentType.ABOUT_US,
        ContentType.PRIVACY_POLICY,
        ContentType.TERMS_AND_CONDITIONS,
      ],
      {
        required_error: "Content type is required",
        invalid_type_error: "Invalid content type",
      },
    ),
  }),
});

export const appContentValidation = {
  updateSchema,
};
