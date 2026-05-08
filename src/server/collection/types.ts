import { z } from "zod";

export const collectionPhaseSchema = z.enum(["capture", "organize", "create", "publish", "iterate"]);

export type CollectionPhase = z.infer<typeof collectionPhaseSchema>;
