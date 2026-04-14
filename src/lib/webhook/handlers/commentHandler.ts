// src/lib/webhook/handlers/commentHandler.ts
import { CommentChange } from "../types";
import { replyToComment } from "@/lib/messenger";

export async function handleComment(change: CommentChange) {
  const commentId = change.value.comment_id;
  const commentText = change.value.message || "";
  const userId = change.value.from?.id;

  console.log(`💬 Comment [${commentId}] from ${userId}: ${commentText}`);

  // رد تلقائي لجذب المستخدم إلى Messenger
  const replyMessage = `🎁 مرحباً! شكراً لتعليقك 😊
للحصول على التفاصيل والعروض الحصرية، يرجى مراسلتنا عبر رسائل الصفحة الخاصّة:
👉 [أرسل رسالة الآن]`;

  await replyToComment(commentId, replyMessage);
}