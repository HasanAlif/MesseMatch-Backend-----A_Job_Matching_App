import nodemailer from "nodemailer";
import config from "../config";

const emailSender = async (
  to: string,
  html: string,
  subject: string,
): Promise<void> => {
  if (!config.emailSender.email || !config.emailSender.app_pass) {
    console.warn("Email credentials not configured. Email not sent.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: config.emailSender.email,
      pass: config.emailSender.app_pass,
    },
  });

  await transporter.sendMail({
    from: `"${config.site_name || "MesseMatch"}" <${config.emailSender.email}>`,
    to,
    subject,
    html,
  });
};

export default emailSender;
