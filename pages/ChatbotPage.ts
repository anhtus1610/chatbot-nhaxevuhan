import { Page, Locator } from '@playwright/test';

export class ChatbotPage {
    readonly page: Page;
    readonly chatInput: Locator;
    readonly sendButton: Locator;
    readonly loadingDot: Locator;
    readonly assistantMessages: Locator;

    constructor(page: Page) {
        this.page = page;
        this.chatInput = page.getByPlaceholder('Nhập câu hỏi của bạn tại đây...');
        this.sendButton = page.locator('button:has(svg.lucide-send)');
        this.loadingDot = page.locator('.loading-dots'); 
        this.assistantMessages = page.locator('div.message-bubble.assistant-message');
    }

    async navigate() {
        await this.page.goto('/');
    }

    async sendMessage(message: string) {
        await this.chatInput.fill(message);

        const responsePromise = this.page.waitForResponse(response => 
            response.url().includes('/api/chat') && response.status() === 200
        );

        await this.sendButton.click();
        await responsePromise;

        await this.loadingDot.waitFor({ state: 'hidden', timeout: 30000 });
    }

    async getLastBotResponse(): Promise<string> {
        const lastMessage = this.assistantMessages.last();
        await lastMessage.waitFor({ state: 'visible', timeout: 20000 });
        await this.page.waitForTimeout(5000); 
        
        const rawText = await lastMessage.innerText();
        return rawText.replace(/\s+/g, ' ').trim().toLowerCase();
    }
}