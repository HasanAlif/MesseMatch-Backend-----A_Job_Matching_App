import mongoose, { Document, Schema } from "mongoose";

export enum ContentType {
  ABOUT_US = "about-us",
  PRIVACY_POLICY = "privacy-policy",
  TERMS_AND_CONDITIONS = "terms-and-conditions",
}

export interface IAppContent extends Document {
  _id: string;
  type: ContentType;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppContentSchema = new Schema<IAppContent>(
  {
    type: {
      type: String,
      enum: Object.values(ContentType),
      required: [true, "Content type is required"],
      unique: true,
      index: true,
    },
    content: {
      type: String,
      required: [true, "Content is required"],
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

export const AppContent = mongoose.model<IAppContent>(
  "AppContent",
  AppContentSchema,
);
