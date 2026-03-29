import mongoose, { Document, Schema, Types } from "mongoose";

export enum NotificationType {
  JOB_APPLICATION = "JOB_APPLICATION",
  JOB_UPDATE = "JOB_UPDATE",
  MESSAGE = "MESSAGE",
  SYSTEM = "SYSTEM",
  MARKETING = "MARKETING",
}

export enum NotificationStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
  READ = "READ",
}

export interface INotification extends Document {
  _id: string;
  userId: Types.ObjectId;
  title: string;
  body: string;
  data?: Record<string, string>;
  type: NotificationType;
  status: NotificationStatus;
  fcmMessageId?: string;
  errorMessage?: string;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    data: {
      type: Map,
      of: String,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      default: NotificationType.SYSTEM,
    },
    status: {
      type: String,
      enum: Object.values(NotificationStatus),
      default: NotificationStatus.PENDING,
    },
    fcmMessageId: {
      type: String,
    },
    errorMessage: {
      type: String,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, status: 1 });
NotificationSchema.index({ status: 1, createdAt: 1 });

export const Notification = mongoose.model<INotification>(
  "Notification",
  NotificationSchema,
);
