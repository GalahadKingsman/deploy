import { z } from 'zod';

export interface TopicV1 {
  id: string;
  slug: string;
  title: string;
}

export interface ListTopicsResponseV1 {
  items: TopicV1[];
}

export interface ListCourseTopicsResponseV1 {
  items: TopicV1[];
}

export interface SetCourseTopicsRequestV1 {
  topicIds: string[];
}

export const TopicV1Schema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
});

export const ListTopicsResponseV1Schema = z.object({
  items: z.array(TopicV1Schema),
});

export const ListCourseTopicsResponseV1Schema = ListTopicsResponseV1Schema;

export const SetCourseTopicsRequestV1Schema = z.object({
  topicIds: z.array(z.string().uuid()),
});
