import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodEffects } from "zod";

const ZOD_PRIMITIVES = [
  "ZodString",
  "ZodNumber",
  "ZodBoolean",
  "ZodEnum",
  "ZodNativeEnum",
  "ZodLiteral",
  "ZodDate",
];

const validateRequest =
  (schema: AnyZodObject | ZodEffects<any>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let schemaShape = null;
      if ("_def" in schema && "shape" in schema._def) {
        schemaShape = schema._def.shape();
      } else if (
        "_def" in schema &&
        "schema" in schema._def &&
        schema._def.schema &&
        "shape" in schema._def.schema._def
      ) {
        schemaShape = schema._def.schema._def.shape();
      }

      const bodyField = schemaShape?.body;
      const bodyIsObjectWrapper =
        bodyField &&
        !ZOD_PRIMITIVES.includes(bodyField._def?.typeName as string);

      const hasRequestStructure =
        schemaShape &&
        (bodyIsObjectWrapper || schemaShape.params || schemaShape.query);

      const dataToValidate = hasRequestStructure
        ? {
            body: req.body,
            params: req.params,
            query: req.query,
          }
        : req.body;

      const parsedData = await schema.parseAsync(dataToValidate);

      if (hasRequestStructure) {
        if (parsedData?.body) {
          req.body = parsedData.body;
        }
        if (parsedData?.params) {
          req.params = parsedData.params;
        }
        if (parsedData?.query) {
          req.query = parsedData.query;
        }
      } else {
        req.body = parsedData;
      }

      return next();
    } catch (err) {
      next(err);
    }
  };

export default validateRequest;
