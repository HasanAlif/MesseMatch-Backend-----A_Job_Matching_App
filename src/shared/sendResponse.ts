import { Response } from "express";
import normalizeUndefinedToNull from "./normalizeUndefinedToNull";

interface IMeta {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
}

interface IResponse<T> {
  statusCode: number;
  success: boolean;
  message: string;
  meta?: IMeta;
  data: T | null;
}

const sendResponse = <T>(res: Response, data: IResponse<T>) => {
  const responseData: Record<string, any> = {
    success: data.success,
    message: data.message,
    data: normalizeUndefinedToNull(data.data),
  };

  if (data.meta) {
    responseData.meta = normalizeUndefinedToNull(data.meta);
  }

  res.status(data.statusCode).json(responseData);
};

export default sendResponse;
