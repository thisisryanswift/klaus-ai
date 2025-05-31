
export interface BoardGame {
  id: string;
  name: string;
  imageUrl: string;
  description?: string; 
  systemPrompt?: string;
  gameSchema?: Record<string, any>;
}