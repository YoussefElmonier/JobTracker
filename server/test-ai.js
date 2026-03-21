require('dotenv').config();
const ai = require('./utils/ai');

(async () => {
    try {
        console.log('Testing cover letter generation...');
        const cl = await ai.generateCoverLetter({
            title: 'Frontend Engineer',
            company: 'Google',
            description: 'We are looking for a frontend engineer.'
        });
        console.log('Cover Letter Result:\n', cl);
    } catch (e) {
        console.error('Test Failed:', e);
    }
})();
