import cookingImg from '../../assets/Templates/Stato_Cooking.jpg';
import creativityImg from '../../assets/Templates/Stato_Creativity.jpg';
import dancingImg from '../../assets/Templates/Stato_Dancing.jpg';
import mediaImg from '../../assets/Templates/Stato_Media.jpg';

export type ProjectTemplate = {
  key: string;
  label: string;
  description: string;
  // Prefill values (user can edit before saving)
  project: {
    title: string;
    type: 'project_open' | 'project_closed' | 'event' | 'outreach' | 'open_door';
    targetGroup?: string;
    description?: string;
    categoryName?: string;
  };
  image: {
    previewUrl: string;
    // Used for uploading the template image to backend uploads, so stored URLs stay stable across deployments.
    fetchUrl: string;
    filename: string;
  };
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    key: 'creativity',
    label: 'Kreativ',
    description: 'Basteln, Malen, Werken – offenes Kreativangebot.',
    project: {
      title: 'Kreativangebot',
      type: 'project_open',
      targetGroup: 'Jugendliche',
      description:
        'Offenes Kreativangebot (z. B. Basteln, Malen, Gestalten). Materialien und Ideen sind vorhanden – der Fokus liegt auf Mitmachen und Ausprobieren.',
      categoryName: 'Künstlerisches Gestalten (u.a. Basteln, Malen)',
    },
    image: {
      previewUrl: creativityImg,
      fetchUrl: creativityImg,
      filename: 'template-kreativ.jpg',
    },
  },
  {
    key: 'dancing',
    label: 'Tanzen',
    description: 'Tanz & Bewegung – Choreo, Freestyle, Musik.',
    project: {
      title: 'Tanzen & Bewegung',
      type: 'project_open',
      targetGroup: 'Jugendliche',
      description:
        'Tanzangebot mit Musik – von Freestyle bis Choreo. Niedrigschwellig, gemeinschaftlich und ohne Vorkenntnisse nutzbar.',
      categoryName: 'Musik und Tanz',
    },
    image: {
      previewUrl: dancingImg,
      fetchUrl: dancingImg,
      filename: 'template-tanzen.jpg',
    },
  },
  {
    key: 'media',
    label: 'Medienraum',
    description: 'Medien, Games, Kreativ-Tools – Lernen & Spaß.',
    project: {
      title: 'Medienraum',
      type: 'project_open',
      targetGroup: 'Jugendliche',
      description:
        'Angebot im Medienraum: kreative Medienarbeit, digitale Tools, ggf. Gaming – mit Fokus auf kompetentem Umgang und gemeinsamer Gestaltung.',
      categoryName: 'Medienbildung',
    },
    image: {
      previewUrl: mediaImg,
      fetchUrl: mediaImg,
      filename: 'template-medienraum.jpg',
    },
  },
  {
    key: 'cooking',
    label: 'Kochen',
    description: 'Gemeinsam kochen – gesunde Ernährung & Alltag.',
    project: {
      title: 'Kochen',
      type: 'project_open',
      targetGroup: 'Jugendliche',
      description:
        'Gemeinsames Kochen und Essen – alltagsnah, partizipativ und mit Fokus auf gesunde Ernährung.',
      categoryName: 'Ernährung und Gesundheit',
    },
    image: {
      previewUrl: cookingImg,
      fetchUrl: cookingImg,
      filename: 'template-kochen.jpg',
    },
  },
];
