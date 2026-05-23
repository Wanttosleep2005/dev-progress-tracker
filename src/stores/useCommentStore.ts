import { create } from 'zustand';
import type { TaskComment } from '../types';
import { addComment, deleteComment, getCommentsByTask } from '../db/database';

interface CommentStore {
  comments: Record<number, TaskComment[]>;
  load: (taskId: number) => Promise<void>;
  add: (comment: Omit<TaskComment, 'id' | 'createdAt'>) => Promise<void>;
  remove: (id: number, taskId: number) => Promise<void>;
}

export const useCommentStore = create<CommentStore>((set) => ({
  comments: {},

  load: async (taskId) => {
    const comments = await getCommentsByTask(taskId);
    set(state => ({ comments: { ...state.comments, [taskId]: comments } }));
  },

  add: async (comment) => {
    await addComment(comment);
    const comments = await getCommentsByTask(comment.taskId);
    set(state => ({ comments: { ...state.comments, [comment.taskId]: comments } }));
  },

  remove: async (id, taskId) => {
    await deleteComment(id);
    const comments = await getCommentsByTask(taskId);
    set(state => ({ comments: { ...state.comments, [taskId]: comments } }));
  },
}));
