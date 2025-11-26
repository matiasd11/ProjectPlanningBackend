const nodemailer = require("nodemailer");

async function sendEmail({ to, subject, text, auth }) {

    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: auth.user,
                pass: auth.pass
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