import nodemailer from 'nodemailer';
import { SystemSetting } from '../models/SystemSetting.js';

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const emailConfig = await SystemSetting.findOne({ key: 'email_settings' });
    
    if (!emailConfig || !emailConfig.value || !emailConfig.value.apiKey) {
      console.error('Email settings not configured');
      return false;
    }

    const { apiKey, fromEmail, service } = emailConfig.value;

    // This is a generic implementation. Depending on the service, 
    // you might use different transporters.
    // Assuming 'SendGrid' or similar with an API key as password
    const transporter = nodemailer.createTransport({
      service: service || 'SendGrid',
      auth: {
        user: 'apikey', // Common for SendGrid
        pass: apiKey
      }
    });

    const info = await transporter.sendMail({
      from: fromEmail || '"Flow Agent" <noreply@flowagent.com>',
      to,
      subject,
      html
    });

    console.log('Message sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};
