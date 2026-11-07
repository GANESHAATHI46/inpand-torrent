import {
  TERMS_VERSION,
  TERMS_STORAGE_KEY,
  TERMS_TIMESTAMP_KEY,
  TERMS_SECTIONS,
} from '../../src/constants/termsAndConditions';

describe('Terms and Conditions Constants & Schema Tests', () => {
  it('has valid version string and storage keys', () => {
    expect(TERMS_VERSION).toBe('1.0.0');
    expect(TERMS_STORAGE_KEY).toBe('@inpand_terms_accepted_version');
    expect(TERMS_TIMESTAMP_KEY).toBe('@inpand_terms_accepted_timestamp');
  });

  it('contains exactly 18 comprehensive legal sections', () => {
    expect(TERMS_SECTIONS.length).toBe(18);
  });

  it('verifies required legal sections are present and non-empty', () => {
    const titles = TERMS_SECTIONS.map((s) => s.title.toLowerCase());

    expect(titles[0]).toContain('acceptance of terms');
    expect(titles[1]).toContain('nature of the software');
    expect(titles[2]).toContain('user responsibility');
    expect(titles[3]).toContain('prohibited activities');
    expect(titles[4]).toContain('intellectual property');
    expect(titles[5]).toContain('disclaimer of warranties');
    expect(titles[6]).toContain('limitation of liability');
    expect(titles[7]).toContain('privacy');
    expect(titles[8]).toContain('network');
    expect(titles[9]).toContain('third-party');
    expect(titles[10]).toContain('storage');
    expect(titles[11]).toContain('open source');
    expect(titles[12]).toContain('age restrictions');
    expect(titles[13]).toContain('export controls');
    expect(titles[14]).toContain('termination');
    expect(titles[15]).toContain('modifications');
    expect(titles[16]).toContain('governing law');
    expect(titles[17]).toContain('contact');

    for (const section of TERMS_SECTIONS) {
      expect(section.id).toBeGreaterThan(0);
      expect(section.title.length).toBeGreaterThan(5);
      expect(section.content.length).toBeGreaterThan(50);
    }
  });
});

