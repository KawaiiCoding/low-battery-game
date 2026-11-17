export type Speaker = 'chip' | 'you' | 'mom' | 'narrator';

export type Backdrop = 'bedroom-night' | 'phone' | 'dialup' | 'profile' | 'petsim' | 'voicemail' | 'bedroom-morning';

export type StoryLine =
  | { who: Speaker; text: string; backdrop?: Backdrop; shake?: boolean }
  | { who: 'choice'; text: string; backdrop?: Backdrop };

export type StoryId = 'intro' | 'after1' | 'after2' | 'ending';

export const STORIES: Record<StoryId, StoryLine[]> = {
  intro: [
    { who: 'narrator', backdrop: 'bedroom-night', text: '11:58 PM. You are 32 years old.' },
    { who: 'narrator', text: '47 unread emails. 3 group chats. 1 voicemail from MOM.' },
    { who: 'you', text: "I'll listen to it tomorrow." },
    { who: 'narrator', text: 'You always say that. Your phone buzzes: 1% BATTERY.' },
    { who: 'narrator', text: 'Your eyes close...' },
    { who: 'narrator', backdrop: 'phone', shake: true, text: '*BZZZZT*' },
    { who: 'chip', text: 'Whoa! A user! Nobody has opened this flip phone since 2005!' },
    { who: 'you', text: 'Wait... am I INSIDE my old phone?' },
    { who: 'chip', text: "Yep. I'm Chip, the battery icon. Bad news: your REAL phone is at 1%." },
    { who: 'chip', text: 'If the battery hits 0% while you are in here... you are stuck. Forever.' },
    { who: 'you', text: 'Stuck in a flip phone?!' },
    { who: 'chip', text: 'With 8 polyphonic ringtones. Forever. The only way out is the VOICEMAIL.' },
    { who: 'chip', text: 'Move and I will auto-ping anything that gets close. Grab ^ bolts to recharge!' },
    { who: 'chip', text: 'First stop: the Dial-Up Maze. Try not to scream like the modem.' },
  ],
  after1: [
    { who: 'narrator', backdrop: 'dialup', text: 'The Modem lets out one last screech... and hangs up.' },
    { who: 'chip', text: 'Nice! You are now connected at a blazing 56 kilobits!' },
    { who: 'you', text: 'Is that... fast?' },
    { who: 'chip', text: 'No. Next up: your old profile page. Brace for auto-playing music.' },
    { who: 'you', text: 'Oh no. Did I have a glitter background?' },
    { who: 'chip', text: 'You had THREE glitter backgrounds.' },
  ],
  after2: [
    { who: 'narrator', backdrop: 'profile', text: 'Your Top Friend pops like a balloon full of glitter.' },
    { who: 'you', text: 'I ranked people. In public. Who let me do that?' },
    { who: 'chip', text: 'Everyone did it. Okay, last stop before the voicemail.' },
    { who: 'chip', text: 'The Pet Sim. You had a little digital pet named Pixel...' },
    { who: 'you', text: '...and I stopped feeding it when I got my first phone with a camera.' },
    { who: 'chip', text: 'It remembers. It is VERY hungry. Good luck!' },
  ],
  ending: [
    { who: 'narrator', backdrop: 'petsim', text: 'Pixel stops. It burps. Then it smiles at you.' },
    { who: 'chip', text: 'It was never mad. It just wanted you to come back sometime.' },
    { who: 'you', text: '...yeah. I think I know someone else like that.' },
    { who: 'narrator', backdrop: 'voicemail', text: 'You reach the VOICEMAIL. 1 new message.' },
    { who: 'mom', text: "Hi sweetie, it's Mom. Nothing important, I promise." },
    { who: 'mom', text: 'I found your old flip phone in a box and thought of you.' },
    { who: 'mom', text: 'Call me when you can, okay? No rush. Love you.' },
    { who: 'chip', text: 'Battery is charged. Time to go home. It was fun, user!' },
    { who: 'narrator', backdrop: 'bedroom-morning', text: '7:02 AM. Your phone: 100%.' },
    { who: 'choice', text: 'Call Mom' },
    { who: 'narrator', text: 'Ringing...' },
    { who: 'mom', text: 'Hello? Oh! Hi, sweetie!' },
    { who: 'you', text: 'Hi, Mom. I got your message.' },
  ],
};

export const SPEAKER_NAMES: Record<Speaker, string> = {
  chip: 'Chip',
  you: 'You',
  mom: 'Mom',
  narrator: '',
};
