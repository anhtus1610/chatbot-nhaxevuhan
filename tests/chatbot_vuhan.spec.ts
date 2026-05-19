import { test, expect } from '@playwright/test';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ChatbotPage } from '../pages/ChatbotPage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const csvFilePath = './data.csv'; 

const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });

interface TestCase {
    ID: string;
    Module: string;
    Input: string;
    'Expected Result': string;
}

const records: TestCase[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_quotes: true
});

for (const record of records) {
    if (!record.ID || record.ID.trim() === "") continue;

    test(`Kiểm tra ${record.ID}: ${record.Input}`, async ({ page }) => {
        const chatbot = new ChatbotPage(page);

        await chatbot.navigate();
        await chatbot.sendMessage(record.Input);
        const actualText = await chatbot.getLastBotResponse();

        const expectedKeywords = record['Expected Result']
            .split(',')
            .map(k => k.replace(/\s+/g, ' ').trim().toLowerCase())
            .filter(k => k.length > 0);

        // 4. Kiểm tra mức độ khớp từ khóa
        const matchedKeywords = expectedKeywords.filter(keyword => 
            actualText.includes(keyword)
        );

        const passRate = matchedKeywords.length / expectedKeywords.length;
        const isPass = passRate >= 0.5;

        if (!isPass) {
            console.log(`--- FAIL: ${record.ID} ---`);
            console.log(`Nội dung thực tế: ${actualText}`);
            console.log(`Chỉ khớp ${matchedKeywords.length}/${expectedKeywords.length} từ khóa.`);
            console.log(`Các từ khớp: ${matchedKeywords.join(', ')}`);
        }

        expect(isPass, `Tỷ lệ khớp từ khóa quá thấp: ${(passRate * 100).toFixed(0)}%`).toBe(true);
    });
}