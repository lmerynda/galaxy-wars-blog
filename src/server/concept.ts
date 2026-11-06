// Temporary: UI concept exploration. Removed once a concept is chosen.
import { cookies } from "next/headers";
import { isConcept, type Concept } from "@/lib/concepts";
export async function currentConcept(): Promise<Concept> {
  const value = (await cookies()).get("concept")?.value;
  return isConcept(value) ? value : "current";
}
