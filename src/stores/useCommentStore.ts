import { create } from 'zustand';
import type { TaskComment } from '../types';
import { addComment, db, deleteComment, getCommentsByTask } from '../db/database';
import { useCloudStore } from './useCloudStore';
import { useToast } from './useToast';

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
    const task = await db.tasks.get(comment.taskId);
    if (!useCloudStore.getState().canEdit(task?.projectId ?? null)) {
      useToast.getState().add('你没有评论该共享项目任务的权限。', 'warning');
      return;
    }
    await addComment(comment);
    const comments = await getCommentsByTask(comment.taskId);
    set(state => ({ comments: { ...state.comments, [comment.taskId]: comments } }));
  },

  remove: async (id, taskId) => {
    const task = await db.tasks.get(taskId);
    if (!useCloudStore.getState().canEdit(task?.projectId ?? null)) {
      useToast.getState().add('你没有删除该共享项目评论的权限。', 'warning');
      return;
    }
    await deleteComment(id);
    const comments = await getCommentsByTask(taskId);
    set(state => ({ comments: { ...state.comments, [taskId]: comments } }));
  },
}));
