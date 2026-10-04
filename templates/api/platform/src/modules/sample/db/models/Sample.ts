import type { Model } from "mongoose";
import type { IModels } from "../../../../connectionResolvers.ts";
import { type ISampleDocument, sampleSchema } from "../definitions/sample.ts";

export interface ISampleModel extends Model<ISampleDocument> {
  list(): Promise<ISampleDocument[]>;
}

// Model statics live on the schema class, matching the monorepo's
// loadXClass(models) convention.
export const loadSampleClass = (models: IModels) => {
  class Sample {
    public static list() {
      return models.Samples.find().sort({ createdAt: -1 }).lean();
    }
  }

  sampleSchema.loadClass(Sample);

  return sampleSchema;
};
