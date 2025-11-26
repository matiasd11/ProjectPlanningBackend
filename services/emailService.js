const nodemailer = require("nodemailer");

async function sendEmail({ to, subject, text }) {

    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS // no la password común, sino una App Password
            }
        });

        const info = await transporter.sendMail({
            from: `"Project Planning" <${process.env.GMAIL_USER}>`,
            to,
            subject,
            text
        });

        console.log("✉️ Email enviado:", info.messageId);

        return { success: true, info };
    } catch (error) {
        console.error("❌ Error enviando email:", error);
        return { success: false, error };
    }

}

module.exports = { sendEmail };