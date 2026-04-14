// src/lib/webhook/types.ts
export type MessengerMessage = {
  sender: { id: string };
  message?: { text?: string; mid?: string };
  postback?: { payload?: string };
};

export type CommentChange = {
  field: "feed";
  value: {
    comment_id: string;
    message?: string;
    from?: { id?: string };
  };
};

export type WebhookEntry = {
  messaging?: MessengerMessage[];
  changes?: CommentChange[];
};

export type WebhookBody = {
  entry?: WebhookEntry[];
};