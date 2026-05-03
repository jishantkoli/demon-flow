import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { User } from '../lib/auth';
import { Mail, Settings, Save, FileText, Server, AlertCircle, CheckCircle, Megaphone, Send } from 'lucide-react';

const VARIABLES = [
  '{{teacher_name}}', '{{head_name}}', '{{form_link}}', '{{school_code}}'
];

const ANNOUNCEMENT_VARIABLES = [
  '{{recipient_name}}', '{{recipient_email}}', '{{school_code}}', '{{role}}'
];

export default function EmailCenter({ user }: { user: User }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [announcementSending, setAnnouncementSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [settings, setSettings] = useState({
    apiKey: '',
    fromEmail: 'noreply@flowagent.com',
    service: 'SendGrid',
    templates: {
      teacher_template: {
        subject: 'You have been nominated!',
        body: 'Hello {{teacher_name}},\n\nYour head {{head_name}} has nominated you for a form. Please fill it here: {{form_link}}\n\nSchool Code: {{school_code}}'
      },
      head_template: {
        subject: 'Nomination Successful',
        body: 'Hello {{head_name}},\n\nYou have successfully nominated {{teacher_name}}. They have been sent an email with the link.'
      },
      announcement_template: {
        subject: 'Important Announcement',
        body: 'Hello {{recipient_name}},\n\nThis is an important announcement from admin.\n\nRegards,\nAdmin Team'
      }
    }
  });
  const [announcement, setAnnouncement] = useState({
    audience: 'teachers',
    school_code: '',
    subject: 'Important Announcement',
    body: 'Hello {{recipient_name}},\n\nThis is an important announcement from admin.\n\nRegards,\nAdmin Team'
  });

  const ensureTemplates = (raw: any) => {
    const existing = raw?.templates || {};
    return {
      teacher_template: {
        subject: existing?.teacher_template?.subject || settings.templates.teacher_template.subject,
        body: existing?.teacher_template?.body || settings.templates.teacher_template.body
      },
      head_template: {
        subject: existing?.head_template?.subject || settings.templates.head_template.subject,
        body: existing?.head_template?.body || settings.templates.head_template.body
      },
      announcement_template: {
        subject: existing?.announcement_template?.subject || settings.templates.announcement_template.subject,
        body: existing?.announcement_template?.body || settings.templates.announcement_template.body
      }
    };
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api.get('/settings/email_settings');
        if (data) {
          const templates = ensureTemplates(data);
          setSettings(prev => ({ ...prev, ...data, templates }));
          setAnnouncement(prev => ({
            ...prev,
            subject: templates.announcement_template.subject,
            body: templates.announcement_template.body
          }));
        }
      } catch (err) {
        console.error('Failed to fetch email settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.post('/settings/email_settings', { value: settings });
      setMessage({ type: 'success', text: 'Email settings saved successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendAnnouncement = async () => {
    setAnnouncementSending(true);
    setMessage(null);
    try {
      const payload = {
        subject: announcement.subject,
        body: announcement.body,
        audience: announcement.audience,
        school_code: announcement.school_code?.trim() || undefined
      };
      const res = await api.post('/notifications/announcement', payload);
      setMessage({
        type: 'success',
        text: `Announcement sent. Total: ${res.total || 0}, Sent: ${res.sent_count || 0}, Failed: ${res.failed_count || 0}`
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to send announcement' });
    } finally {
      setAnnouncementSending(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold font-heading">Email Center</h1>
        <p className="text-sm text-slate-500">Configure email API and notification templates</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* API Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Server size={20} className="text-primary" /> API Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Email Service Provider</label>
            <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none"
              value={settings.service} onChange={e => setSettings({ ...settings, service: e.target.value })}>
              <option value="SendGrid">SendGrid</option>
              <option value="Resend">Resend</option>
              <option value="Gmail">Gmail</option>
              <option value="Other">Other (SMTP)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">API Key / Password</label>
            <input type="password" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none"
              value={settings.apiKey} onChange={e => setSettings({ ...settings, apiKey: e.target.value })} placeholder="Enter your API key" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">From Email Address</label>
            <input type="email" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none"
              value={settings.fromEmail} onChange={e => setSettings({ ...settings, fromEmail: e.target.value })} placeholder="noreply@yourdomain.com" />
          </div>
        </div>
      </div>

      {/* Templates */}
      <div className="grid grid-cols-1 gap-6">
        {/* Teacher Template */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Mail size={20} className="text-primary" /> Teacher Nomination Template</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
              <input className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none font-semibold"
                value={settings.templates.teacher_template.subject} 
                onChange={e => setSettings({ ...settings, templates: { ...settings.templates, teacher_template: { ...settings.templates.teacher_template, subject: e.target.value } } })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Email Body</label>
              <textarea rows={6} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none resize-none font-sans"
                value={settings.templates.teacher_template.body}
                onChange={e => setSettings({ ...settings, templates: { ...settings.templates, teacher_template: { ...settings.templates.teacher_template, body: e.target.value } } })} />
            </div>
          </div>
        </div>

        {/* Head Template */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><FileText size={20} className="text-primary" /> Head Confirmation Template</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
              <input className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none font-semibold"
                value={settings.templates.head_template.subject}
                onChange={e => setSettings({ ...settings, templates: { ...settings.templates, head_template: { ...settings.templates.head_template, subject: e.target.value } } })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Email Body</label>
              <textarea rows={4} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none resize-none font-sans"
                value={settings.templates.head_template.body}
                onChange={e => setSettings({ ...settings, templates: { ...settings.templates, head_template: { ...settings.templates.head_template, body: e.target.value } } })} />
            </div>
          </div>
        </div>
      </div>

      {/* Manual Announcement */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Megaphone size={20} className="text-primary" /> Manual Announcement Mail
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Audience</label>
            <select
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none"
              value={announcement.audience}
              onChange={e => setAnnouncement(prev => ({ ...prev, audience: e.target.value }))}
            >
              <option value="teachers">All Teachers</option>
              <option value="functionaries">All School Heads / Functionaries</option>
              <option value="by_school">By School Code (Teachers + Heads)</option>
              <option value="all_users">All Users</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">School Code (Optional)</label>
            <input
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none"
              value={announcement.school_code}
              onChange={e => setAnnouncement(prev => ({ ...prev, school_code: e.target.value }))}
              placeholder="e.g. SCH-101"
              disabled={announcement.audience !== 'by_school'}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase">Announcement Subject</label>
          <input
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none font-semibold"
            value={announcement.subject}
            onChange={e => {
              const subject = e.target.value;
              setAnnouncement(prev => ({ ...prev, subject }));
              setSettings(prev => ({
                ...prev,
                templates: {
                  ...prev.templates,
                  announcement_template: { ...prev.templates.announcement_template, subject }
                }
              }));
            }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase">Announcement Body</label>
          <textarea
            rows={6}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none resize-none font-sans"
            value={announcement.body}
            onChange={e => {
              const body = e.target.value;
              setAnnouncement(prev => ({ ...prev, body }));
              setSettings(prev => ({
                ...prev,
                templates: {
                  ...prev.templates,
                  announcement_template: { ...prev.templates.announcement_template, body }
                }
              }));
            }}
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSendAnnouncement}
            disabled={announcementSending}
            className="px-6 py-2.5 bg-navy text-white rounded-xl text-sm font-bold hover:bg-navy-light disabled:opacity-50 flex items-center gap-2"
          >
            <Send size={16} /> {announcementSending ? 'Sending...' : 'Send Announcement'}
          </button>
        </div>
      </div>

      {/* Variables Help */}
      <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200">
        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Available Variables</h4>
        <div className="flex flex-wrap gap-2">
          {VARIABLES.map(v => (
            <span key={v} className="px-2 py-1 bg-white rounded-lg text-[10px] font-mono font-bold text-primary border border-slate-200">{v}</span>
          ))}
          {ANNOUNCEMENT_VARIABLES.map(v => (
            <span key={v} className="px-2 py-1 bg-white rounded-lg text-[10px] font-mono font-bold text-emerald-700 border border-emerald-200">{v}</span>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="px-10 py-3 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2">
          <Save size={18} /> {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
}
