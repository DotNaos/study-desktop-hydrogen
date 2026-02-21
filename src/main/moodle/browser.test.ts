/**
 * Unit tests for Moodle HTML parser.
 *
 * Run with: npx vitest run src/main/moodle/browser.test.ts
 *
 * To test with real HTML:
 * 1. Save a Moodle course page HTML to src/main/moodle/__fixtures__/course.html
 * 2. Run the tests
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import { MoodleResource } from './types';
import { parseResources } from './parsing';

// Sample HTML for a single section with resources
const SAMPLE_SECTION_HTML = `
<li id="section-2" class="section course-section main clearfix" data-sectionid="2" data-id="247427" data-number="2" data-sectionname="Thema 1: Einführung">
  <div class="content course-content-item-content">
    <ul class="section m-0 p-0 img-text d-block" data-for="cmlist">
      <li class="activity resource modtype_resource" id="module-881745" data-for="cmitem" data-id="881745">
        <div class="activity-item focus-control" data-activityname="Folien Teil 1" data-region="activity-card">
          <div class="activity-grid">
            <div class="activity-icon activityiconcontainer smaller content courseicon align-self-start me-2">
              <img src="https://moodle.fhgr.ch/theme/image.php/boost_union/core/1765204713/f/pdf?filtericon=1" class="activityicon" data-region="activity-icon" data-id="881745" alt="">
            </div>
            <div class="activity-name-area activity-instance d-flex flex-column me-2">
              <div class="activitytitle modtype_resource position-relative align-self-start">
                <div class="activityname">
                  <a href="https://moodle.fhgr.ch/mod/resource/view.php?id=881745" class="aalink stretched-link">
                    <span class="instancename">Folien Teil 1 <span class="accesshide"> File</span></span>
                  </a>
                  <span class="ms-1">
                    <span class="activitybadge badge rounded-pill badge-none">PDF</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </li>
      <li class="activity resource modtype_resource" id="module-881747" data-for="cmitem" data-id="881747">
        <div class="activity-item focus-control" data-activityname="Aufgabenblatt 01" data-region="activity-card">
          <div class="activity-grid">
            <div class="activity-icon activityiconcontainer smaller content courseicon align-self-start me-2">
              <img src="https://moodle.fhgr.ch/theme/image.php/boost_union/core/1765204713/f/pdf?filtericon=1" class="activityicon" data-region="activity-icon" data-id="881747" alt="">
            </div>
            <div class="activity-name-area activity-instance d-flex flex-column me-2">
              <div class="activitytitle modtype_resource position-relative align-self-start">
                <div class="activityname">
                  <a href="https://moodle.fhgr.ch/mod/resource/view.php?id=881747" class="aalink stretched-link">
                    <span class="instancename">Aufgabenblatt 01 <span class="accesshide"> File</span></span>
                  </a>
                  <span class="ms-1">
                    <span class="activitybadge badge rounded-pill badge-none">PDF</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </li>
      <li class="activity resource modtype_resource" id="module-881748" data-for="cmitem" data-id="881748">
        <div class="activity-item focus-control" data-activityname="Aufgabenblatt 01 -- Lösung" data-region="activity-card">
          <div class="activity-grid">
            <div class="activity-icon activityiconcontainer smaller content courseicon align-self-start me-2">
              <img src="https://moodle.fhgr.ch/theme/image.php/boost_union/core/1765204713/f/pdf?filtericon=1" class="activityicon" data-region="activity-icon" data-id="881748" alt="">
            </div>
            <div class="activity-name-area activity-instance d-flex flex-column me-2">
              <div class="activitytitle modtype_resource position-relative align-self-start">
                <div class="activityname">
                  <a href="https://moodle.fhgr.ch/mod/resource/view.php?id=881748" class="aalink stretched-link">
                    <span class="instancename">Aufgabenblatt 01 -- Lösung <span class="accesshide"> File</span></span>
                  </a>
                  <span class="ms-1">
                    <span class="activitybadge badge rounded-pill badge-none">PDF</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</li>
`;

describe('MoodleFetcher HTML Parser', () => {
  const baseUrl = 'https://moodle.fhgr.ch';

  beforeAll(() => {
    // No-op: kept for parity with the previous structure.
  });

  describe('parseResources', () => {
    it('should extract all resources from sample section HTML', () => {
      const resources = parseResources(SAMPLE_SECTION_HTML, '19479', baseUrl);

      expect(resources).toHaveLength(3);
    });

    it('should correctly map resource IDs to names', () => {
      const resources = parseResources(SAMPLE_SECTION_HTML, '19479', baseUrl);

      const resourceMap = new Map(resources.map(r => [r.id, r.name]));

      expect(resourceMap.get('881745')).toBe('Folien Teil 1');
      expect(resourceMap.get('881747')).toBe('Aufgabenblatt 01');
      expect(resourceMap.get('881748')).toBe('Aufgabenblatt 01 -- Lösung');
    });

    it('should extract file type as pdf', () => {
      const resources = parseResources(SAMPLE_SECTION_HTML, '19479', baseUrl);

      for (const resource of resources) {
        expect(resource.fileType).toBe('pdf');
      }
    });

    it('should set resource type correctly', () => {
      const resources = parseResources(SAMPLE_SECTION_HTML, '19479', baseUrl);

      for (const resource of resources) {
        expect(resource.type).toBe('resource');
      }
    });

    it('should generate correct URLs', () => {
      const resources = parseResources(SAMPLE_SECTION_HTML, '19479', baseUrl);

      const r0 = resources.find(r => r.id === '881745');
      expect(r0?.url).toBe('https://moodle.fhgr.ch/mod/resource/view.php?id=881745&redirect=1');
    });
  });

  describe('with real HTML file (course.html)', () => {
    const fixturesDir = join(__dirname, '__fixtures__');
    const courseHtmlPath = join(fixturesDir, 'course.html');
    const expectedJsonPath = join(fixturesDir, 'course.expected.json');

    it.skipIf(!existsSync(courseHtmlPath))('should parse all resources from course.html', () => {
      const html = readFileSync(courseHtmlPath, 'utf-8');
      const resources = parseResources(html, 'test-course', baseUrl);

      // Log what was parsed for debugging
      console.log(`Parsed ${resources.length} resources from course.html:`);
      for (const r of resources) {
        console.log(`  - [${r.id}] ${r.name} (${r.fileType}) [${r.sectionName}]`);
      }

      expect(resources.length).toBeGreaterThan(0);
    });

    it.skipIf(!existsSync(courseHtmlPath) || !existsSync(expectedJsonPath))(
      'should match expected JSON output',
      () => {
        const html = readFileSync(courseHtmlPath, 'utf-8');
        const resources = parseResources(html, 'test-course', baseUrl);

        const expectedJson = JSON.parse(readFileSync(expectedJsonPath, 'utf-8')) as Array<{
          id: string;
          name: string;
          sectionName: string;
          fileType: string;
        }>;

        // Create a simplified version for comparison
        const actual = resources.map((r) => ({
          id: r.id,
          name: r.name,
          sectionName: r.sectionName,
          fileType: r.fileType,
        }));

        // Check count matches
        expect(actual.length).toBe(expectedJson.length);

        // Check each resource matches
        for (let i = 0; i < expectedJson.length; i++) {
          const expected = expectedJson[i];
          const found = actual.find((r) => r.id === expected.id);

          if (!found) {
            throw new Error(`Missing resource with ID ${expected.id} (${expected.name})`);
          }

          expect(found.name).toBe(expected.name);
          expect(found.sectionName).toBe(expected.sectionName);
          expect(found.fileType).toBe(expected.fileType);
        }
      }
    );

    it.skipIf(!existsSync(courseHtmlPath))('each resource should have unique ID and non-empty name', () => {
      const html = readFileSync(courseHtmlPath, 'utf-8');
      const resources = parseResources(html, 'test-course', baseUrl);

      const ids = new Set<string>();
      for (const r of resources) {
        expect(r.name).toBeTruthy();
        expect(r.name.length).toBeGreaterThan(0);
        expect(ids.has(r.id)).toBe(false);
        ids.add(r.id);
      }
    });
  });
});
