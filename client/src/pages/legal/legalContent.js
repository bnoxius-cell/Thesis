// The wording of the Terms of Service and Privacy Policy. Keep it in step with what the
// app really does (server/models, server/controllers). When it changes in a way users
// should re-accept, bump LEGAL_VERSION in server/utils/legal.js as well, so everyone
// sees the consent prompt again.

export const LEGAL_UPDATED = "September 30, 2026";
export const SUPPORT_EMAILS = [
  "tkishore1434val@student.fatima.edu.ph",
  "amreniva0131val@student.fatima.edu.ph",
];
export const SUPPORT_EMAIL = SUPPORT_EMAILS[0];

// Blocks: { p } a paragraph, { ul } a bullet list, { mail } a paragraph ending in the support address.
export const TERMS = {
  title: "Terms of Service",
  intro:
    "These terms are the ground rules for using StressCare. They're written to be read, so please give them a couple of minutes.",
  sections: [
    {
      id: "agreement",
      title: "Agreeing to these terms",
      blocks: [
        { p: "By creating an account or signing in to StressCare, you agree to these Terms of Service and to our Privacy Policy. If you don't agree, please don't use the app." },
        { p: "StressCare is meant for college students. If you're under 18, check with a parent or guardian before you sign up." },
      ],
    },
    {
      id: "what-it-is",
      title: "What StressCare is, and what it isn't",
      blocks: [
        { p: "StressCare is a web app that helps you plan tasks, keep a class schedule, work with classmates and keep an eye on your workload and well-being. It was built as a student thesis project." },
        { p: "It is not a medical service. The workload score, the check-ins (PSS-10 and WHO-5) and the tips are there to help you notice patterns. They don't diagnose anything, and they don't replace a doctor, a counsellor or a psychologist." },
        { p: "If you feel unsafe, or you're worried about hurting yourself, contact your local emergency services or your school's guidance office right away. Please don't wait for an app to tell you it's serious." },
      ],
    },
    {
      id: "accounts",
      title: "Your account",
      blocks: [
        { ul: [
          "Give us accurate information, and keep it up to date.",
          "Keep your password to yourself. What happens under your account is on you, so tell us quickly if you think someone else got in.",
          "One person, one account. Please don't sign up on behalf of somebody else.",
          "Signing in with Google is limited to Fatima student accounts (@student.fatima.edu.ph).",
        ] },
      ],
    },
    {
      id: "use",
      title: "Using StressCare respectfully",
      blocks: [
        { p: "Groups, chat, friends and shared schedules put you in touch with other people. Please don't:" },
        { ul: [
          "harass, threaten, bully or impersonate anyone;",
          "post anything unlawful, hateful or sexually explicit;",
          "share other people's private information;",
          "try to break, overload or get around the app's security, or use another person's account;",
          "use the app to spam people or to send them things they didn't ask for.",
        ] },
        { p: "We can remove content and suspend accounts that break these rules." },
      ],
    },
    {
      id: "content",
      title: "What you put in",
      blocks: [
        { p: "Your tasks, schedules, pictures, messages and check-in answers stay yours. You give StressCare permission to store them and to show them to the people you choose to share them with, because that's how the app works." },
        { p: "Only add things you have the right to add. If you upload a picture, it should be yours or something you're allowed to use." },
      ],
    },
    {
      id: "sharing",
      title: "Sharing with others",
      blocks: [
        { ul: [
          "A schedule you share is view-only. People you share it with can open it and copy it into their own schedules. Their copy is theirs, and changing it never changes yours.",
          "Tasks you post in a group can be added to your groupmates' own task lists.",
          "Anyone who has a schedule share code can view that schedule. Turn the code off, or make a new one, if it ends up somewhere it shouldn't.",
          "Your friends can see your name, email, avatar and profile tag.",
        ] },
      ],
    },
    {
      id: "availability",
      title: "Availability, and the fine print about it",
      blocks: [
        { p: "StressCare is a student project running on free hosting. It might be slow, go down, or change without notice, and it might stop running one day. We'll do our best, but we can't promise it will always be available or that nothing will ever be lost." },
        { p: "Please don't rely on StressCare as the only place your deadlines live." },
      ],
    },
    {
      id: "liability",
      title: "Responsibility",
      blocks: [
        { p: "StressCare is provided as is. As far as the law allows, the people who built it aren't liable for losses that come from using it, including missed deadlines or decisions you make based on the workload score or the tips. Nothing here limits rights you have under Philippine law that can't be limited." },
      ],
    },
    {
      id: "ending",
      title: "Ending things",
      blocks: [
        { p: "You can stop using StressCare whenever you like. To have your account and its data deleted, email us (details below) from the address on the account." },
        { p: "We may suspend or close accounts that break these terms, or the whole service if the project ends." },
      ],
    },
    {
      id: "changes",
      title: "Changes to these terms",
      blocks: [
        { p: "If we change these terms in a way that matters, we'll update the date at the top and ask you to agree again the next time you open the app." },
        { p: "These terms are governed by the laws of the Republic of the Philippines." },
      ],
    },
    {
      id: "contact",
      title: "Contact",
      blocks: [{ mail: "Questions about these terms? Write to" }],
    },
  ],
};

export const PRIVACY = {
  title: "Privacy Policy",
  intro:
    "This explains what StressCare collects, why, who can see it and what you can do about it. We try to collect only what the app needs, and we don't sell your data.",
  sections: [
    {
      id: "who",
      title: "Who's responsible",
      blocks: [
        { p: "StressCare is run by the student team behind this thesis project. We handle your personal information in line with the Data Privacy Act of 2012 (Republic Act No. 10173) of the Philippines." },
      ],
    },
    {
      id: "collect",
      title: "What we collect",
      blocks: [
        { ul: [
          "Account details: your name, your email and a scrambled (hashed) version of your password. If you use Google sign-in, we get your name, email and profile picture from Google.",
          "Profile details you add: bio, program, the hours you can study per day, your well-being goal and a picture.",
          "Check-in results: your answers and scores for the PSS-10 stress scale and the WHO-5 well-being index, with dates.",
          "Your tasks: titles, courses, descriptions, due dates, estimated hours, difficulty and importance.",
          "Your schedules: classes and activities with times, places and notes, any pictures you attach, the country you pick for holidays and days you mark off.",
          "Social features: friend connections, groups you belong to, group messages and tasks shared in groups.",
          "Notifications: your inbox and your notification preferences. If you turn on phone or computer alerts, we keep the address your browser gives us for sending them.",
          "Technical basics: a login cookie, plus a few settings saved in your browser (see Cookies and storage).",
        ] },
      ],
    },
    {
      id: "sensitive",
      title: "Check-ins are sensitive",
      blocks: [
        { p: "Your stress and well-being answers say something about your health, so we treat them as sensitive personal information. They are used to show you your own results and to shape your own workload score and tips. They are not shown to your friends, group members or anyone else using the app." },
        { p: "The team that runs StressCare can technically access the database, and we keep that to what's needed to run and fix the app." },
      ],
    },
    {
      id: "why",
      title: "Why we use it",
      blocks: [
        { ul: [
          "To run your account and the features you use.",
          "To work out your workload score, weekly plan and guidance, using your tasks, schedule and check-ins.",
          "To send the emails and notifications the app needs, like verification codes, password resets and deadline reminders.",
          "To keep the service secure and fix problems.",
        ] },
        { p: "StressCare was built for a thesis. If results are reported, they'll be combined and anonymized, and they won't name you or show your individual answers." },
      ],
    },
    {
      id: "share",
      title: "Who else sees it",
      blocks: [
        { p: "Other people: friends can see your name, email, avatar and profile tag. Group members see your name and avatar and what you post in the group. People you share a schedule with can view that schedule." },
        { p: "Services that help run the app. They only handle data to do their job:" },
        { ul: [
          "MongoDB Atlas stores the database.",
          "Render runs the server, and Vercel hosts the website and passes requests to the server.",
          "Brevo sends our emails.",
          "Google handles Google sign-in, and serves the fonts the site uses, which means Google sees your IP address when the page loads.",
          "Nager.Date provides public holidays. It only receives a country and a year.",
          "Your browser's push service (run by Google, Apple or Mozilla) delivers phone and computer alerts if you turn them on.",
        ] },
        { p: "We don't sell your information and we don't show ads. We may share information if the law requires it." },
      ],
    },
    {
      id: "cookies",
      title: "Cookies and storage",
      blocks: [
        { p: "StressCare uses one login cookie. It's kept for a day, or up to 30 days if you tick Remember me. It stays out of reach of page scripts (httpOnly) and it's what keeps you signed in." },
        { p: "Your browser also stores a few settings so the app feels right: your light or dark choice, when you snoozed a check-in reminder, and whether alerts are on for this device. We don't use advertising or tracking cookies." },
      ],
    },
    {
      id: "keep",
      title: "How long we keep it",
      blocks: [
        { p: "We keep your information while your account exists. When you ask us to delete your account, we delete your account and the data tied to it. Copies in backups may take a little longer to disappear." },
      ],
    },
    {
      id: "rights",
      title: "Your rights",
      blocks: [
        { p: "Under the Data Privacy Act you have the right to:" },
        { ul: [
          "be informed about how your data is used (that's this page);",
          "see the data we hold about you, and get a copy;",
          "correct anything that's wrong;",
          "object to how it's used, or withdraw your consent;",
          "have it blocked, removed or deleted;",
          "make a complaint to the National Privacy Commission (privacy.gov.ph) if you think your data was mishandled.",
        ] },
        { p: "You can edit most of your details yourself on your Profile and Settings pages. For anything else, write to us." },
      ],
    },
    {
      id: "security",
      title: "Keeping it safe",
      blocks: [
        { p: "Passwords are stored hashed, never as plain text. Connections to the site use HTTPS. No system is perfectly safe, so if we learn of a breach that affects you, we'll tell you and the authorities as the law requires." },
      ],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      blocks: [
        { p: "If this policy changes in a way that matters, we'll update the date above and ask you to review it the next time you open the app." },
      ],
    },
    {
      id: "contact",
      title: "Contact",
      blocks: [{ mail: "To ask about your data, or to have your account deleted, write to" }],
    },
  ],
};
