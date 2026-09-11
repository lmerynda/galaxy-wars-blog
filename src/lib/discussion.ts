export type Comment = {
  id: string;
  parentId: string | null;
  name: string;
  body: string;
  hidden: boolean;
  createdAt: string;
};
export type Poll = {
  id: string;
  question: string;
  options: { id: string; label: string; count: number }[];
  closed: boolean;
  version: number;
  total: number;
  selected: string | null;
};
export type DiscussionData = { comments: Comment[]; poll: Poll | null };
