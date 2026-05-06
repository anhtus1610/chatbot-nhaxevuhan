import { test, expect } from '@playwright/test';
import * as stringSimilarity from 'string-similarity';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

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
    relax_quotes: true // Nên thêm cái này để tránh lỗi Invalid Closing Quote như lúc nãy
});

for (const record of records) {
    if (!record.ID || record.ID.trim() === "") continue;

    test(`Kiểm tra ${record.ID}: ${record.Input}`, async ({ page }) => {
        await page.goto('https://chatbot-nhaxevuhan.vercel.app/chat'); 

        const chatInput = page.getByPlaceholder('Nhập câu hỏi của bạn tại đây...');
        await chatInput.fill(record.Input);

        const responsePromise = page.waitForResponse(response => 
            response.url().includes('/api/chat') && response.status() === 200
        );

        await page.click('button:has(svg.lucide-send)');

        await responsePromise;
        
        // --- SỬA LỖI Ở ĐÂY ---
        // Không dùng .last() ở đây vì chúng ta muốn lấy TẤT CẢ tin nhắn Bot vừa trả về
        const allResponseLocators = page.locator('div.message-markdown p.m-0');
        
        // Đợi ít nhất 1 tin nhắn xuất hiện
        await allResponseLocators.first().waitFor({ state: 'visible', timeout: 15000 });
        
        // Lấy danh sách nội dung của toàn bộ tin nhắn và gộp lại
        const texts = await allResponseLocators.allInnerTexts();
        const actualText = texts.join(' ').trim(); 
        
        const expectedText = record['Expected Result'];

        // Tính toán độ tương đồng
        const similarity = stringSimilarity.compareTwoStrings(
            actualText.toLowerCase().trim(), 
            expectedText.toLowerCase().trim()
        );

        const percentage = (similarity * 100).toFixed(2);
        console.log(`TC ${record.ID}: Độ tương đồng ${percentage}%`);

        if (similarity < 0.4) {
            console.log(`--- FAIL DETAIL ---`);
            console.log(`Input: ${record.Input}`);
            console.log(`Actual (Merged): ${actualText}`);
            console.log(`Expected: ${expectedText}`);
            console.log(`-------------------`);
        }

        expect(similarity, `Độ tương đồng quá thấp: ${percentage}%`).toBeGreaterThan(0.4); 
    });
}