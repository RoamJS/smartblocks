import { InputTextNode } from "roamjs-components/types";
import { z } from "zod";

const zInputTextNodeBase = z.object({
  text: z.string(),
  uid: z.string().optional(),
  heading: z.number().optional(),
  textAlign: z.enum(["left", "center", "right", "justify"]).optional(),
  viewType: z.enum(["document", "bullet", "numbered"]).optional(),
  open: z.boolean().optional(),
  props: z.record(z.unknown()).optional(),
});

// TODO: This should live in roamjs-components
const zInputTextNode: z.ZodType<InputTextNode> = z.lazy(() =>
  zInputTextNodeBase.and(
    z.object({ children: z.array(zInputTextNode).optional() })
  )
);
export const zCommandOutput = z
  .string()
  .or(z.string().array())
  .or(zInputTextNode.array());
