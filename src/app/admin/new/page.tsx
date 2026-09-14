import { randomUUID } from "node:crypto";
import { ownerPage } from "@/server/http";
import { Editor } from "@/components/Editor";
export const dynamic = "force-dynamic";
export default async function NewPost() {
  await ownerPage("/admin/new");
  return (
    <Editor
      initial={{
        id: randomUUID(),
        version: 0,
        slug: null,
        title: "",
        paragraphOne: "",
        paragraphTwo: "",
        videoId: null,
        videoIds: [],
        images: [],
        publishedAt: null,
        publishedDay: null,
      }}
    />
  );
}
