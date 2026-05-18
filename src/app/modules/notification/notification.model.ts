import mongoose, { Document, Schema, Types } from "mongoose";

export enum NotificationType {
  JOB_REQUEST_ACCEPTED = "JOB_REQUEST_ACCEPTED",
  JOB_RATING_RECEIVED = "JOB_RATING_RECEIVED",
  DAILY_JOB_MATCHES = "DAILY_JOB_MATCHES",
  SWIPE_THRESHOLD = "SWIPE_THRESHOLD",
  SWIPE_LIMIT_REACHED = "SWIPE_LIMIT_REACHED",
  JOB_LIMIT_WARNING = "JOB_LIMIT_WARNING",
  JOB_LIMIT_REACHED = "JOB_LIMIT_REACHED",
  PLAN_EXPIRING_30D = "PLAN_EXPIRING_30D",
  PLAN_EXPIRING_14D = "PLAN_EXPIRING_14D",
  PLAN_EXPIRING_7D = "PLAN_EXPIRING_7D",
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
  isRead: boolean;
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
      type: Schema.Types.Mixed,
      default: undefined,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(NotificationStatus),
      default: NotificationStatus.PENDING,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
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
NotificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });

export const Notification = mongoose.model<INotification>(
  "Notification",
  NotificationSchema,
);
