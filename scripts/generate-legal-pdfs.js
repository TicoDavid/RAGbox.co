#!/usr/bin/env node
/**
 * Generate 8 synthetic legal PDFs for the RAGbox demo vault.
 * Run: node scripts/generate-legal-pdfs.js
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'demo', 'legal-vault');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Helpers ──────────────────────────────────────────────────────────────────

function createDoc(filename, opts = {}) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 72, bottom: 72, left: 72, right: 72 },
    bufferPages: true,
    ...opts,
  });
  const stream = fs.createWriteStream(path.join(OUT_DIR, filename));
  doc.pipe(stream);
  return { doc, stream };
}

function addHeader(doc, firmName, firmAddress) {
  const y = 30;
  doc.fontSize(9).font('Helvetica-Bold').text(firmName, 72, y, { align: 'center' });
  doc.fontSize(7).font('Helvetica').text(firmAddress, 72, y + 12, { align: 'center' });
  doc.moveTo(72, y + 26).lineTo(540, y + 26).strokeColor('#333333').lineWidth(0.5).stroke();
}

function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Temporarily remove bottom margin so PDFKit doesn't auto-create a new page
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.fontSize(8).font('Helvetica').text(
      `Page ${i + 1} of ${range.count}`,
      0, doc.page.height - 50,
      { align: 'center', width: doc.page.width, lineBreak: false }
    );
    doc.page.margins.bottom = savedBottom;
  }
}

function title(doc, text) {
  doc.moveDown(1).fontSize(14).font('Helvetica-Bold').text(text, { align: 'center' });
  doc.moveDown(0.5);
}

function subtitle(doc, text) {
  doc.moveDown(0.5).fontSize(11).font('Helvetica-Bold').text(text);
  doc.moveDown(0.3);
}

function body(doc, text) {
  doc.fontSize(10).font('Helvetica').text(text, { align: 'justify', lineGap: 2 });
  doc.moveDown(0.3);
}

function numberedSection(doc, number, heading, content) {
  doc.moveDown(0.4);
  doc.fontSize(11).font('Helvetica-Bold').text(`${number}. ${heading}`);
  doc.moveDown(0.2);
  doc.fontSize(10).font('Helvetica').text(content, { align: 'justify', lineGap: 2 });
  doc.moveDown(0.3);
}

function subSection(doc, number, content) {
  doc.fontSize(10).font('Helvetica').text(`    ${number} ${content}`, { align: 'justify', lineGap: 2, indent: 20 });
  doc.moveDown(0.2);
}

function signatureBlock(doc, parties) {
  doc.moveDown(1.5);
  doc.fontSize(10).font('Helvetica-Bold').text('IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.');
  doc.moveDown(1.5);
  for (const party of parties) {
    doc.fontSize(10).font('Helvetica-Bold').text(party.name);
    doc.moveDown(1.2);
    doc.font('Helvetica').text('By: _________________________________');
    doc.text(`Name: ${party.signatory}`);
    doc.text(`Title: ${party.title}`);
    doc.text('Date: _________________________________');
    doc.moveDown(1);
  }
}

function finalize(doc) {
  addPageNumbers(doc);
  doc.end();
}

// ── Document A: Mutual NDA ──────────────────────────────────────────────────

function generateNDA() {
  const { doc } = createDoc('01_Mutual_NDA.pdf');
  addHeader(doc, 'HARRISON & COLE LLP', '1200 Brickell Avenue, Suite 1800 | Miami, FL 33131 | (305) 555-0142');

  title(doc, 'MUTUAL NON-DISCLOSURE AGREEMENT');
  body(doc, 'This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of January 15, 2026 ("Effective Date"), by and between:');
  doc.moveDown(0.3);
  body(doc, 'MERIDIAN VENTURES LLC, a Delaware limited liability company, with its principal place of business at 500 Park Avenue, Suite 3200, New York, NY 10022 ("Meridian"); and');
  body(doc, 'BLACKSTONE ADVISORY GROUP INC., a New York corporation, with its principal place of business at 345 Madison Avenue, 18th Floor, New York, NY 10017 ("Blackstone").');
  body(doc, 'Each individually referred to as a "Party" and collectively as the "Parties."');

  doc.moveDown(0.5);
  body(doc, 'WHEREAS, Meridian and Blackstone desire to explore a potential business relationship involving the evaluation of certain private equity opportunities and co-investment structures (the "Purpose"); and');
  body(doc, 'WHEREAS, in connection with the Purpose, each Party may disclose to the other certain confidential and proprietary information;');
  body(doc, 'NOW, THEREFORE, in consideration of the mutual covenants and agreements set forth herein, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Parties agree as follows:');

  numberedSection(doc, 'ARTICLE I', 'DEFINITIONS',
    '1.1 "Confidential Information" means any and all non-public, proprietary, or confidential information disclosed by either Party (the "Disclosing Party") to the other Party (the "Receiving Party"), whether disclosed orally, in writing, electronically, or by inspection of tangible objects, including without limitation: (a) trade secrets, inventions, ideas, processes, formulas, source and object code, data, programs, software, and other works of authorship; (b) financial information, business plans, projections, customer lists, and marketing strategies; (c) information regarding potential investments, portfolio companies, fund performance, investor lists, and transaction terms; (d) technical specifications, engineering drawings, and product designs; and (e) any information that is marked or otherwise identified as confidential or proprietary at the time of disclosure, or that a reasonable person would understand to be confidential given the nature of the information and circumstances of disclosure.\n\n1.2 "Representatives" means a Party\'s directors, officers, employees, agents, advisors (including attorneys, accountants, consultants, bankers, and financial advisors), and any controlled affiliates and their respective directors, officers, employees, and agents.\n\n1.3 "Permitted Purpose" means the evaluation, negotiation, and potential consummation of business transactions between the Parties, including joint ventures, co-investments, advisory mandates, and related commercial activities.');

  numberedSection(doc, 'ARTICLE II', 'CONFIDENTIALITY OBLIGATIONS',
    '2.1 Non-Disclosure. The Receiving Party shall: (a) hold the Confidential Information in strict confidence; (b) not disclose the Confidential Information to any third party, except to its Representatives who have a need to know such information for the Permitted Purpose and who are bound by confidentiality obligations no less restrictive than those set forth herein; and (c) not use the Confidential Information for any purpose other than the Permitted Purpose.\n\n2.2 Standard of Care. The Receiving Party shall protect the Confidential Information using the same degree of care that it uses to protect its own confidential information of a similar nature, but in no event less than reasonable care.\n\n2.3 Compelled Disclosure. If the Receiving Party or any of its Representatives is compelled by applicable law, regulation, or legal process to disclose any Confidential Information, the Receiving Party shall: (a) provide the Disclosing Party with prompt written notice of such requirement to the extent legally permitted; (b) cooperate with the Disclosing Party in seeking a protective order or other appropriate remedy; and (c) disclose only that portion of the Confidential Information that is legally required to be disclosed.');

  numberedSection(doc, 'ARTICLE III', 'EXCLUSIONS FROM CONFIDENTIAL INFORMATION',
    'The obligations set forth in Article II shall not apply to information that: (a) is or becomes publicly available through no fault of the Receiving Party; (b) was known to the Receiving Party prior to disclosure by the Disclosing Party, as documented by the Receiving Party\'s written records; (c) is independently developed by the Receiving Party without use of or reference to the Confidential Information; or (d) is lawfully received by the Receiving Party from a third party without restriction on disclosure and without breach of any obligation of confidentiality.');

  numberedSection(doc, 'ARTICLE IV', 'TERM AND TERMINATION',
    '4.1 Term. This Agreement shall remain in effect for a period of three (3) years from the Effective Date, unless earlier terminated by either Party upon thirty (30) days\' prior written notice to the other Party.\n\n4.2 Termination for Cause. Either Party may terminate this Agreement immediately upon written notice if the other Party materially breaches any provision of this Agreement and fails to cure such breach within fifteen (15) days after receiving written notice thereof.\n\n4.3 Survival. The confidentiality obligations set forth in Article II shall survive the expiration or termination of this Agreement for a period of five (5) years from the date of disclosure of the applicable Confidential Information. The obligations with respect to trade secrets shall survive for so long as such information constitutes a trade secret under applicable law.\n\n4.4 Return of Materials. Upon the expiration or termination of this Agreement, or upon the written request of the Disclosing Party, the Receiving Party shall promptly: (a) return to the Disclosing Party all tangible materials containing Confidential Information; or (b) destroy all such materials and certify such destruction in writing; provided, however, that the Receiving Party may retain one (1) archival copy solely for compliance purposes, subject to the continuing confidentiality obligations herein.');

  numberedSection(doc, 'ARTICLE V', 'PAYMENT TERMS AND EXPENSES',
    '5.1 No License Fee. No license fee, royalty, or other payment is due from either Party under this Agreement. Each Party shall bear its own costs and expenses incurred in connection with the performance of its obligations under this Agreement.\n\n5.2 Transaction Costs. In the event the Parties proceed to negotiate and consummate any business transaction arising from the exchange of Confidential Information, the allocation of transaction costs, fees, and expenses shall be governed by the definitive transaction agreements entered into by the Parties.\n\n5.3 Advisory Fees. Blackstone shall be entitled to advisory fees as separately agreed upon in writing for any engagement arising from the Permitted Purpose, with standard rates commencing at Two Hundred Fifty Thousand Dollars ($250,000.00) for initial advisory mandates and One Hundred Fifty Dollars ($150.00) per hour for additional consulting services.');

  numberedSection(doc, 'ARTICLE VI', 'INDEMNIFICATION',
    '6.1 Indemnification by Receiving Party. The Receiving Party shall indemnify, defend, and hold harmless the Disclosing Party and its officers, directors, employees, agents, and affiliates (collectively, the "Indemnified Parties") from and against any and all losses, damages, liabilities, costs, and expenses (including reasonable attorneys\' fees and costs of litigation) arising out of or resulting from: (a) any unauthorized use or disclosure of the Confidential Information by the Receiving Party or its Representatives; (b) any breach by the Receiving Party of its obligations under this Agreement; or (c) any third-party claim resulting from the Receiving Party\'s unauthorized use of the Confidential Information.\n\n6.2 Limitation of Liability. IN NO EVENT SHALL EITHER PARTY BE LIABLE TO THE OTHER PARTY FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO THIS AGREEMENT, REGARDLESS OF THE FORM OF ACTION OR THE THEORY OF LIABILITY, EVEN IF SUCH PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. The aggregate liability of either Party under this Agreement shall not exceed Five Hundred Thousand Dollars ($500,000.00).');

  numberedSection(doc, 'ARTICLE VII', 'EQUITABLE RELIEF',
    'Each Party acknowledges and agrees that a breach or threatened breach of this Agreement may cause irreparable harm to the Disclosing Party for which monetary damages may not be an adequate remedy. Accordingly, in addition to any other remedies available at law or in equity, the Disclosing Party shall be entitled to seek injunctive relief, specific performance, and other equitable relief, without the necessity of proving actual damages or posting any bond or other security.');

  numberedSection(doc, 'ARTICLE VIII', 'GOVERNING LAW AND JURISDICTION',
    '8.1 Governing Law. This Agreement shall be governed by and construed in accordance with the laws of the State of New York, without regard to its conflicts of law principles.\n\n8.2 Jurisdiction. The Parties hereby irrevocably submit to the exclusive jurisdiction of the federal and state courts located in the County of New York, State of New York, for the purpose of any suit, action, or other proceeding arising out of or relating to this Agreement.\n\n8.3 Dispute Resolution. Prior to initiating any litigation, the Parties agree to attempt in good faith to resolve any dispute arising under this Agreement through mediation conducted by the American Arbitration Association ("AAA") in New York, New York, in accordance with the AAA Commercial Mediation Procedures. If the dispute is not resolved within sixty (60) days of the commencement of mediation, either Party may pursue its rights at law or in equity.');

  numberedSection(doc, 'ARTICLE IX', 'GENERAL PROVISIONS',
    '9.1 Entire Agreement. This Agreement constitutes the entire agreement between the Parties concerning the subject matter hereof and supersedes all prior agreements, understandings, negotiations, and discussions, whether oral or written.\n\n9.2 Amendments. This Agreement may not be amended, modified, or supplemented except by a written instrument executed by both Parties.\n\n9.3 Assignment. Neither Party may assign or transfer this Agreement or any of its rights or obligations hereunder without the prior written consent of the other Party, provided that either Party may assign this Agreement to an affiliate or in connection with a merger, acquisition, or sale of all or substantially all of its assets.\n\n9.4 Notices. All notices required or permitted under this Agreement shall be in writing and shall be deemed given when delivered personally, sent by certified mail (return receipt requested), or sent by nationally recognized overnight courier to the addresses set forth in the preamble of this Agreement.\n\n9.5 Severability. If any provision of this Agreement is held invalid or unenforceable by a court of competent jurisdiction, the remaining provisions shall continue in full force and effect.\n\n9.6 Waiver. The failure of either Party to enforce any provision of this Agreement shall not constitute a waiver of such provision or of the right to enforce it at a later time.\n\n9.7 Counterparts. This Agreement may be executed in counterparts, each of which shall be deemed an original and all of which together shall constitute one and the same instrument.');

  signatureBlock(doc, [
    { name: 'MERIDIAN VENTURES LLC', signatory: 'Victoria Chen', title: 'Managing Partner' },
    { name: 'BLACKSTONE ADVISORY GROUP INC.', signatory: 'Richard A. Harmon', title: 'Chief Executive Officer' },
  ]);

  finalize(doc);
  console.log('  [1/8] 01_Mutual_NDA.pdf');
}

// ── Document B: Commercial Lease Agreement ──────────────────────────────────

function generateLease() {
  const { doc } = createDoc('02_Commercial_Lease.pdf');
  addHeader(doc, 'BOCA RATON COMMERCIAL REALTY GROUP', '2500 N. Military Trail, Suite 400 | Boca Raton, FL 33431 | (561) 555-0288');

  title(doc, 'COMMERCIAL LEASE AGREEMENT');
  body(doc, 'This Commercial Lease Agreement ("Lease") is entered into as of February 1, 2026, by and between:');
  body(doc, 'PALM BEACH EXECUTIVE PROPERTIES LLC, a Florida limited liability company ("Landlord"), with its principal office at 2500 N. Military Trail, Suite 400, Boca Raton, FL 33431; and');
  body(doc, 'DATABRIDGE TECHNOLOGIES INC., a Delaware corporation authorized to do business in Florida ("Tenant"), with its principal office at 1100 NW 163rd Drive, Miami, FL 33169.');

  numberedSection(doc, 'ARTICLE 1', 'PREMISES',
    '1.1 Leased Premises. Landlord hereby leases to Tenant, and Tenant hereby leases from Landlord, the following described premises (the "Premises"): approximately 12,500 square feet of office space located at 2400 NW Executive Center Drive, Suites 300 and 310, Boca Raton, FL 33431, as more particularly described in Exhibit A attached hereto.\n\n1.2 Common Areas. Tenant shall have the non-exclusive right to use the common areas of the Building, including lobbies, corridors, restrooms, elevators, stairways, and the parking facility, subject to the rules and regulations established by Landlord.\n\n1.3 Parking. Landlord shall provide Tenant with forty-five (45) unreserved parking spaces in the Building\'s parking structure at no additional charge during the initial Term. Five (5) reserved executive spaces shall be provided at a rate of Seventy-Five Dollars ($75.00) per space per month.');

  numberedSection(doc, 'ARTICLE 2', 'TERM',
    '2.1 Initial Term. The initial term of this Lease shall commence on April 1, 2026 (the "Commencement Date") and shall expire on March 31, 2031 (the "Expiration Date"), unless sooner terminated in accordance with the provisions of this Lease (the "Term").\n\n2.2 Renewal Options. Tenant shall have two (2) options to renew this Lease for additional periods of three (3) years each (each a "Renewal Term"), upon the same terms and conditions, except that the Base Rent for each Renewal Term shall be adjusted to the then-prevailing market rate, but in no event less than the Base Rent payable during the final year of the immediately preceding term. Tenant must provide written notice of its intent to exercise each renewal option no later than one hundred eighty (180) days prior to the expiration of the then-current term.\n\n2.3 Early Occupancy. Tenant may occupy the Premises for fixturing and setup purposes beginning thirty (30) days prior to the Commencement Date at no charge, provided that all insurance requirements have been satisfied.');

  numberedSection(doc, 'ARTICLE 3', 'PAYMENT TERMS AND RENT',
    '3.1 Base Rent. Tenant shall pay to Landlord as base rent ("Base Rent") the following amounts during the Term:\n\n    Year 1 (April 2026 - March 2027): $31,250.00 per month ($30.00 per square foot annually)\n    Year 2 (April 2027 - March 2028): $32,291.67 per month ($31.00 per square foot annually)\n    Year 3 (April 2028 - March 2029): $33,333.33 per month ($32.00 per square foot annually)\n    Year 4 (April 2029 - March 2030): $34,375.00 per month ($33.00 per square foot annually)\n    Year 5 (April 2030 - March 2031): $35,416.67 per month ($34.00 per square foot annually)\n\n3.2 Payment Schedule. Base Rent shall be due and payable on the first (1st) day of each calendar month during the Term. The first month\'s rent and the Security Deposit shall be due upon execution of this Lease.\n\n3.3 Late Payment. If any installment of Rent is not received by Landlord within five (5) business days after the date when due, Tenant shall pay a late charge equal to five percent (5%) of the overdue amount, plus interest at the rate of twelve percent (12%) per annum on the unpaid balance.\n\n3.4 Security Deposit. Upon execution of this Lease, Tenant shall deposit with Landlord a security deposit in the amount of Sixty-Two Thousand Five Hundred Dollars ($62,500.00) (the "Security Deposit") as security for the faithful performance of Tenant\'s obligations hereunder.\n\n3.5 Operating Expenses. In addition to Base Rent, Tenant shall pay Tenant\'s proportionate share (18.75%) of actual Operating Expenses for the Building in excess of the Base Year (calendar year 2026) operating expenses.');

  numberedSection(doc, 'ARTICLE 4', 'USE OF PREMISES',
    '4.1 Permitted Use. The Premises shall be used and occupied only for general office purposes, including technology development, data analytics, software engineering, and related administrative functions, and for no other purpose without the prior written consent of Landlord.\n\n4.2 Compliance with Laws. Tenant shall comply with all applicable federal, state, and local laws, ordinances, rules, and regulations in its use and occupancy of the Premises, including the Americans with Disabilities Act.\n\n4.3 Prohibited Uses. Tenant shall not use the Premises for any unlawful purpose, nor shall Tenant cause, maintain, or permit any nuisance in, on, or about the Premises.');

  numberedSection(doc, 'ARTICLE 5', 'MAINTENANCE AND REPAIRS',
    '5.1 Landlord\'s Obligations. Landlord shall maintain in good condition and repair the structural components of the Building, including the roof, exterior walls, foundation, HVAC systems, elevators, and common areas.\n\n5.2 Tenant\'s Obligations. Tenant shall, at its sole cost and expense, maintain the interior of the Premises in good condition and repair, including flooring, interior walls, doors, lighting fixtures, and plumbing fixtures within the Premises.\n\n5.3 Alterations. Tenant shall not make any alterations, additions, or improvements to the Premises (collectively, "Alterations") without the prior written consent of Landlord. Any approved Alterations shall be performed at Tenant\'s expense by contractors approved by Landlord, in a good and workmanlike manner, and in compliance with all applicable laws and building codes.');

  numberedSection(doc, 'ARTICLE 6', 'INSURANCE AND INDEMNIFICATION',
    '6.1 Tenant\'s Insurance. Tenant shall, at its sole cost and expense, maintain throughout the Term: (a) commercial general liability insurance with limits of not less than Two Million Dollars ($2,000,000.00) per occurrence and Five Million Dollars ($5,000,000.00) in the aggregate; (b) property insurance covering Tenant\'s personal property, trade fixtures, and improvements; (c) workers\' compensation insurance as required by Florida law; and (d) business interruption insurance covering not less than twelve (12) months of Rent.\n\n6.2 Indemnification by Tenant. Tenant shall indemnify, defend, and hold harmless Landlord and its officers, directors, employees, agents, and affiliates from and against any and all claims, damages, losses, costs, liabilities, and expenses (including reasonable attorneys\' fees) arising out of or related to: (a) Tenant\'s use or occupancy of the Premises; (b) any act, omission, or negligence of Tenant or its employees, agents, contractors, or invitees; (c) any breach by Tenant of this Lease; or (d) any injury to persons or damage to property occurring in or about the Premises.\n\n6.3 Indemnification by Landlord. Landlord shall indemnify, defend, and hold harmless Tenant from and against any and all claims, damages, losses, costs, liabilities, and expenses arising out of or related to: (a) the negligence or willful misconduct of Landlord or its employees or agents; or (b) Landlord\'s failure to perform its maintenance obligations under this Lease.');

  numberedSection(doc, 'ARTICLE 7', 'TERMINATION AND DEFAULT',
    '7.1 Events of Default by Tenant. The following shall constitute events of default ("Events of Default"): (a) failure to pay Rent or any other sum due within ten (10) days after written notice of nonpayment; (b) failure to comply with any other provision of this Lease within thirty (30) days after written notice; (c) the filing of a petition in bankruptcy by or against Tenant; (d) the appointment of a receiver for Tenant\'s assets; (e) the making of an assignment for the benefit of creditors by Tenant; or (f) the abandonment of the Premises by Tenant.\n\n7.2 Landlord\'s Remedies. Upon the occurrence of an Event of Default, Landlord may, at its option: (a) terminate this Lease upon ten (10) days\' written notice to Tenant; (b) re-enter the Premises and remove Tenant and all persons and property; (c) relet the Premises for the account of Tenant; and/or (d) pursue any other remedy available at law or in equity.\n\n7.3 Tenant\'s Right to Terminate. Tenant may terminate this Lease upon ninety (90) days\' written notice if: (a) the Premises are rendered substantially unusable by casualty or condemnation for a period exceeding one hundred twenty (120) days; (b) Landlord fails to provide essential services (HVAC, elevator, utilities) for more than seventy-two (72) consecutive hours after written notice; or (c) Landlord materially defaults in its obligations and fails to cure within sixty (60) days.\n\n7.4 Early Termination Option. Tenant shall have a one-time right to terminate this Lease at the end of Year 3 (March 31, 2029) upon: (a) providing twelve (12) months\' prior written notice; and (b) payment of an early termination fee equal to six (6) months\' then-current Base Rent.');

  numberedSection(doc, 'ARTICLE 8', 'CONFIDENTIALITY',
    '8.1 Confidential Terms. The terms and conditions of this Lease, including all financial terms, shall be considered confidential and shall not be disclosed by either Party to any third party without the prior written consent of the other Party, except: (a) to such Party\'s attorneys, accountants, and financial advisors; (b) as required by law or court order; or (c) in connection with the enforcement of this Lease.\n\n8.2 Tenant Data. Landlord acknowledges that Tenant\'s business involves the processing and storage of sensitive data. Landlord shall not access, monitor, or interfere with Tenant\'s data systems or communications, except as required for Building maintenance with prior notice to Tenant.');

  numberedSection(doc, 'ARTICLE 9', 'ASSIGNMENT AND SUBLETTING',
    '9.1 Consent Required. Tenant shall not assign this Lease or sublet the Premises or any part thereof without the prior written consent of Landlord, which consent shall not be unreasonably withheld, conditioned, or delayed.\n\n9.2 Permitted Transfers. Notwithstanding Section 9.1, Tenant may, without Landlord\'s consent, assign this Lease or sublet the Premises to: (a) any entity controlling, controlled by, or under common control with Tenant; or (b) any entity that acquires all or substantially all of Tenant\'s assets or stock by way of merger, consolidation, or reorganization.');

  numberedSection(doc, 'ARTICLE 10', 'GOVERNING LAW AND JURISDICTION',
    '10.1 Governing Law. This Lease shall be governed by and construed in accordance with the laws of the State of Florida.\n\n10.2 Jurisdiction. Any action arising out of or relating to this Lease shall be brought exclusively in the state or federal courts located in Palm Beach County, Florida, and the Parties hereby consent to the jurisdiction of such courts.\n\n10.3 Attorneys\' Fees. In any action or proceeding arising out of this Lease, the prevailing party shall be entitled to recover its reasonable attorneys\' fees and costs from the non-prevailing party.');

  numberedSection(doc, 'ARTICLE 11', 'MISCELLANEOUS',
    '11.1 Entire Agreement. This Lease, including all exhibits attached hereto, constitutes the entire agreement between the Parties and supersedes all prior negotiations, agreements, and understandings.\n\n11.2 Force Majeure. Neither Party shall be liable for any failure to perform its obligations under this Lease (other than payment obligations) to the extent such failure is caused by events beyond such Party\'s reasonable control, including natural disasters, acts of terrorism, pandemics, or government orders.\n\n11.3 Notices. All notices shall be in writing and sent by certified mail, return receipt requested, or by nationally recognized overnight courier, to the addresses set forth in this Lease.\n\n11.4 Waiver. No waiver by either Party of any default shall be deemed a waiver of any subsequent default.\n\n11.5 Broker\'s Commission. Landlord shall pay a brokerage commission to Cushman & Wakefield in accordance with a separate agreement. Tenant represents that it has not engaged any other broker in connection with this Lease.');

  signatureBlock(doc, [
    { name: 'PALM BEACH EXECUTIVE PROPERTIES LLC', signatory: 'James R. Caldwell', title: 'Managing Member' },
    { name: 'DATABRIDGE TECHNOLOGIES INC.', signatory: 'Priya Ramanathan', title: 'Chief Operating Officer' },
  ]);

  finalize(doc);
  console.log('  [2/8] 02_Commercial_Lease.pdf');
}

// ── Document C: Client Engagement Letter ────────────────────────────────────

function generateEngagementLetter() {
  const { doc } = createDoc('03_Client_Engagement_Letter.pdf');
  addHeader(doc, 'HARRISON & COLE LLP', '1200 Brickell Avenue, Suite 1800 | Miami, FL 33131 | (305) 555-0142');

  doc.moveDown(2);
  doc.fontSize(10).font('Helvetica').text('January 22, 2026');
  doc.moveDown(0.5);
  doc.text('Mr. Jonathan W. Reeves\nChief Executive Officer\nDataBridge Technologies Inc.\n1100 NW 163rd Drive\nMiami, FL 33169');
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').text('Re: Engagement of Legal Services — Corporate Advisory and Regulatory Compliance');
  doc.moveDown(0.5);
  doc.font('Helvetica').text('Dear Mr. Reeves:');
  doc.moveDown(0.3);
  body(doc, 'Thank you for selecting Harrison & Cole LLP ("the Firm" or "we") to represent DataBridge Technologies Inc. ("the Client" or "you") in connection with the matters described below. This letter sets forth the terms and conditions of our engagement and the mutual obligations of the Firm and the Client.');

  subtitle(doc, '1. SCOPE OF ENGAGEMENT');
  body(doc, 'The Firm agrees to provide legal services to the Client in connection with the following matters (collectively, the "Engagement"):\n\n(a) General corporate advisory services, including contract review, corporate governance, and board advisory;\n(b) Regulatory compliance matters related to data privacy (including CCPA, GDPR, and HIPAA where applicable);\n(c) Intellectual property protection strategy and trademark portfolio management;\n(d) Employment law advisory, including review of employment agreements, non-compete covenants, and workplace policies;\n(e) Mergers and acquisitions advisory, including due diligence support and transaction structuring.\n\nThis Engagement does not include litigation, tax advisory, or real estate matters unless separately agreed upon in writing. Should the need for additional services arise, we will discuss and agree upon the scope and fees before commencing work.');

  subtitle(doc, '2. PAYMENT TERMS AND FEE STRUCTURE');
  body(doc, '2.1 Hourly Rates. Our fees for this Engagement shall be based on the following hourly rates:\n\n    Partners: $625.00 per hour\n    Senior Associates: $425.00 per hour\n    Associates: $325.00 per hour\n    Paralegals: $175.00 per hour\n\n2.2 Monthly Retainer. In lieu of hourly billing for routine corporate advisory matters, the Client may elect a monthly retainer of Fifteen Thousand Dollars ($15,000.00) per month, which covers up to thirty (30) hours of combined attorney and paralegal time per month. Hours in excess of the retainer shall be billed at the hourly rates set forth above.\n\n2.3 Billing and Payment. The Firm shall submit monthly invoices for services rendered and expenses incurred. Payment is due within thirty (30) days of the invoice date. Amounts not paid within thirty (30) days shall bear interest at the rate of one and one-half percent (1.5%) per month.\n\n2.4 Initial Retainer Deposit. Upon execution of this engagement letter, the Client shall provide an initial retainer deposit of Twenty-Five Thousand Dollars ($25,000.00), which shall be deposited in the Firm\'s client trust account (IOTA) and applied against invoices as they become due.\n\n2.5 Expenses. The Client shall reimburse the Firm for reasonable out-of-pocket expenses incurred in connection with the Engagement, including filing fees, courier charges, travel expenses, expert witness fees, and electronic research charges.');

  subtitle(doc, '3. CONFIDENTIALITY OBLIGATIONS');
  body(doc, 'All information provided by the Client to the Firm in connection with this Engagement is subject to attorney-client privilege and the Firm\'s ethical obligations of confidentiality under the Florida Rules of Professional Conduct. The Firm shall not disclose any confidential information of the Client to any third party without the Client\'s prior written consent, except as required by law, court order, or the Rules of Professional Conduct.\n\nThe Client acknowledges that the Firm may utilize secure cloud-based document management and communication systems. The Firm represents that all such systems comply with applicable data security standards and the Firm\'s duty of confidentiality.');

  subtitle(doc, '4. CONFLICTS OF INTEREST');
  body(doc, 'The Firm has conducted a conflicts check and confirms that, as of the date of this letter, no conflict of interest exists that would prevent the Firm from representing the Client in the matters described herein. If a conflict arises during the course of the Engagement, the Firm shall promptly notify the Client and take appropriate action as required by the applicable Rules of Professional Conduct.');

  subtitle(doc, '5. TERMINATION');
  body(doc, '5.1 Termination by Client. The Client may terminate this Engagement at any time, with or without cause, upon written notice to the Firm. The Client shall remain responsible for payment of all fees and expenses incurred through the date of termination.\n\n5.2 Termination by Firm. The Firm may withdraw from the Engagement upon reasonable notice to the Client if: (a) the Client fails to fulfill its obligations under this letter, including payment obligations; (b) the Client insists upon a course of action that the Firm reasonably believes to be imprudent or contrary to the Firm\'s professional obligations; (c) a conflict of interest arises that cannot be waived; or (d) other good cause exists as permitted by the applicable Rules of Professional Conduct.\n\n5.3 Effect of Termination. Upon termination, the Firm shall promptly return all original documents and Client materials. The Firm may retain copies of documents as required by its record retention policy and applicable professional regulations.');

  subtitle(doc, '6. INDEMNIFICATION');
  body(doc, 'The Client agrees to indemnify and hold harmless the Firm, its partners, associates, and employees from any and all claims, liabilities, damages, and expenses (including attorneys\' fees) arising out of or related to: (a) any inaccurate or incomplete information provided by the Client; (b) the Client\'s failure to follow the Firm\'s legal advice; or (c) any third-party claims arising from the Client\'s business activities, except to the extent caused by the Firm\'s gross negligence or willful misconduct.');

  subtitle(doc, '7. GOVERNING LAW AND JURISDICTION');
  body(doc, 'This engagement letter shall be governed by and construed in accordance with the laws of the State of Florida. Any dispute arising under this letter shall be submitted to binding arbitration in Miami-Dade County, Florida, administered by the American Arbitration Association under its Commercial Arbitration Rules. Judgment on the award rendered by the arbitrator may be entered in any court having jurisdiction thereof.');

  subtitle(doc, '8. ACCEPTANCE');
  body(doc, 'If the foregoing terms are acceptable, please sign and return one copy of this letter to confirm your agreement. This engagement letter, together with any attachments, constitutes the entire agreement between the Firm and the Client regarding the Engagement and supersedes all prior discussions and agreements.\n\nWe look forward to working with you and DataBridge Technologies. Please do not hesitate to contact me directly if you have any questions.');

  doc.moveDown(1);
  doc.text('Very truly yours,');
  doc.moveDown(1.5);
  doc.font('Helvetica-Bold').text('Margaret A. Harrison');
  doc.font('Helvetica').text('Senior Partner');
  doc.text('Harrison & Cole LLP');
  doc.text('mharrison@harrisoncolellp.com');
  doc.text('Direct: (305) 555-0147');

  doc.moveDown(2);
  doc.text('AGREED AND ACCEPTED:');
  doc.moveDown(1.5);
  doc.text('By: _________________________________');
  doc.text('Name: Jonathan W. Reeves');
  doc.text('Title: Chief Executive Officer');
  doc.text('DataBridge Technologies Inc.');
  doc.text('Date: _________________________________');

  finalize(doc);
  console.log('  [3/8] 03_Client_Engagement_Letter.pdf');
}

// ── Document D: Employment Agreement ────────────────────────────────────────

function generateEmployment() {
  const { doc } = createDoc('04_Employment_Agreement.pdf');
  addHeader(doc, 'NOVATECH SOLUTIONS INC.', '8000 Towers Crescent Drive, Suite 1300 | Tysons Corner, VA 22182 | (703) 555-0391');

  title(doc, 'EMPLOYMENT AGREEMENT');
  body(doc, 'This Employment Agreement ("Agreement") is entered into as of March 1, 2026 (the "Effective Date"), by and between:');
  body(doc, 'NOVATECH SOLUTIONS INC., a Virginia corporation ("Employer" or the "Company"), with its principal place of business at 8000 Towers Crescent Drive, Suite 1300, Tysons Corner, VA 22182; and');
  body(doc, 'MARCUS J. WHITFIELD, an individual residing at 3412 Foxhall Crescent NW, Washington, DC 20007 ("Employee").');
  body(doc, 'WHEREAS, the Company desires to employ Employee as Vice President of Engineering, and Employee desires to accept such employment, upon the terms and conditions set forth herein.');

  numberedSection(doc, 'ARTICLE 1', 'EMPLOYMENT AND DUTIES',
    '1.1 Position. The Company hereby employs Employee as Vice President of Engineering, reporting directly to the Chief Technology Officer.\n\n1.2 Duties. Employee shall perform such duties and responsibilities as are customary for the position, including: (a) leading all software engineering teams across three (3) product lines; (b) overseeing the technical architecture and development roadmap; (c) managing a direct team of approximately forty-five (45) engineers; (d) collaborating with product management and executive leadership on strategic initiatives; and (e) such other duties as may be reasonably assigned.\n\n1.3 Full-Time Employment. Employee shall devote substantially all of his business time, attention, and energies to the performance of his duties hereunder. Employee shall not, without the prior written consent of the Company, engage in any other business activity that conflicts with his duties or obligations under this Agreement.\n\n1.4 Place of Performance. Employee\'s primary place of work shall be the Company\'s offices in Tysons Corner, Virginia, with the flexibility to work remotely up to two (2) days per week. Employee acknowledges that travel of up to twenty percent (20%) may be required.');

  numberedSection(doc, 'ARTICLE 2', 'PAYMENT TERMS AND COMPENSATION',
    '2.1 Base Salary. The Company shall pay Employee an annual base salary of Three Hundred Twenty-Five Thousand Dollars ($325,000.00), payable in accordance with the Company\'s standard payroll practices (currently bi-weekly).\n\n2.2 Annual Bonus. Employee shall be eligible for an annual performance bonus of up to forty percent (40%) of Base Salary (target: $130,000.00), based on the achievement of individual and company performance objectives as determined by the Board of Directors.\n\n2.3 Equity Grant. Subject to Board approval, Employee shall receive: (a) an initial grant of 50,000 shares of restricted stock units ("RSUs") vesting over four (4) years with a one-year cliff (25% vesting at the first anniversary, then 6.25% quarterly thereafter); and (b) eligibility for annual refresh equity grants based on performance.\n\n2.4 Signing Bonus. The Company shall pay Employee a one-time signing bonus of Seventy-Five Thousand Dollars ($75,000.00), payable within thirty (30) days of the Effective Date. If Employee voluntarily resigns or is terminated for Cause within the first twelve (12) months of employment, Employee shall repay the full signing bonus. If such event occurs between twelve (12) and twenty-four (24) months, Employee shall repay fifty percent (50%) of the signing bonus.\n\n2.5 Benefits. Employee shall be entitled to participate in all benefit plans generally available to similarly situated employees, including health insurance (medical, dental, vision), 401(k) with 6% Company match, life insurance, disability insurance, and twenty-five (25) days of paid time off per year.');

  numberedSection(doc, 'ARTICLE 3', 'CONFIDENTIALITY AND INTELLECTUAL PROPERTY',
    '3.1 Confidential Information. Employee acknowledges that during the course of employment, Employee will have access to and become acquainted with Confidential Information. "Confidential Information" includes all non-public information relating to the Company\'s business, including trade secrets, algorithms, source code, product designs, customer lists, financial data, business strategies, and any other information designated as confidential.\n\n3.2 Non-Disclosure. Employee agrees that during the term of employment and for a period of five (5) years following termination, Employee shall not, directly or indirectly, disclose, publish, or use any Confidential Information for any purpose other than in furtherance of Employee\'s duties.\n\n3.3 Work Product. All inventions, discoveries, designs, developments, improvements, works of authorship, and other work product created by Employee during the course of employment, or using Company resources, shall be the sole and exclusive property of the Company. Employee hereby assigns to the Company all right, title, and interest in and to such work product.\n\n3.4 Prior Inventions. Employee has disclosed on Exhibit A attached hereto all inventions, if any, owned by Employee as of the Effective Date that relate to the Company\'s business. These are excluded from the assignment in Section 3.3.');

  numberedSection(doc, 'ARTICLE 4', 'RESTRICTIVE COVENANTS',
    '4.1 Non-Competition. During the term of employment and for a period of twelve (12) months following the date of termination (the "Restricted Period"), Employee shall not, directly or indirectly, engage in, own, manage, operate, control, or participate in any business that competes with the Company\'s business within the United States.\n\n4.2 Non-Solicitation of Employees. During the Restricted Period, Employee shall not, directly or indirectly, solicit, recruit, or hire, or attempt to solicit, recruit, or hire, any employee of the Company or any person who was an employee of the Company within the six (6) months preceding the solicitation.\n\n4.3 Non-Solicitation of Customers. During the Restricted Period, Employee shall not, directly or indirectly, solicit or attempt to solicit the business of any customer or prospective customer of the Company with whom Employee had material contact during the last twelve (12) months of employment.\n\n4.4 Reasonableness. Employee acknowledges that the restrictions contained in this Article 4 are reasonable and necessary to protect the legitimate business interests of the Company.');

  numberedSection(doc, 'ARTICLE 5', 'TERMINATION',
    '5.1 At-Will Employment. Notwithstanding anything to the contrary, Employee\'s employment is at-will and may be terminated by either party at any time, with or without cause, upon thirty (30) days\' written notice.\n\n5.2 Termination for Cause. The Company may terminate Employee\'s employment immediately for "Cause," which includes: (a) material breach of this Agreement; (b) conviction of a felony or crime of moral turpitude; (c) willful misconduct or gross negligence in the performance of duties; (d) fraud, embezzlement, or dishonesty; (e) material violation of Company policies; or (f) continued failure to perform duties after written notice and a thirty (30) day cure period.\n\n5.3 Termination Without Cause. If the Company terminates Employee\'s employment without Cause, Employee shall be entitled to: (a) twelve (12) months of continued Base Salary; (b) a pro-rata portion of the annual bonus for the year of termination; (c) acceleration of RSUs that would have vested within the next twelve (12) months; and (d) twelve (12) months of continued health insurance coverage at the Company\'s expense (the "Severance Package"), subject to Employee executing a general release of claims.\n\n5.4 Resignation for Good Reason. Employee may resign for "Good Reason" upon thirty (30) days\' written notice if: (a) there is a material reduction in Employee\'s Base Salary, title, or duties; (b) the Company relocates Employee\'s primary workplace by more than fifty (50) miles; or (c) the Company materially breaches this Agreement. Resignation for Good Reason shall entitle Employee to the Severance Package.\n\n5.5 Death or Disability. In the event of Employee\'s death or Total Disability (inability to perform essential functions for ninety (90) consecutive days), this Agreement shall terminate, and the Company shall pay accrued but unpaid compensation and a pro-rata bonus.');

  numberedSection(doc, 'ARTICLE 6', 'INDEMNIFICATION',
    'The Company shall indemnify and hold harmless Employee from and against any and all losses, claims, damages, liabilities, and expenses (including reasonable attorneys\' fees) arising out of or related to Employee\'s good-faith performance of duties on behalf of the Company, to the fullest extent permitted by Virginia law and the Company\'s Certificate of Incorporation and Bylaws. The Company shall maintain directors\' and officers\' liability insurance coverage with limits of not less than Five Million Dollars ($5,000,000.00) during Employee\'s employment and for a period of six (6) years thereafter.');

  numberedSection(doc, 'ARTICLE 7', 'GOVERNING LAW AND JURISDICTION',
    '7.1 Governing Law. This Agreement shall be governed by and construed in accordance with the laws of the Commonwealth of Virginia, without regard to its conflicts of law provisions.\n\n7.2 Jurisdiction. Any action arising out of or relating to this Agreement shall be brought exclusively in the state or federal courts located in Fairfax County, Virginia.\n\n7.3 Arbitration. Any dispute arising under this Agreement (other than disputes regarding the enforcement of the restrictive covenants in Article 4) shall be submitted to binding arbitration in Fairfax County, Virginia, administered by JAMS under its Employment Arbitration Rules.');

  numberedSection(doc, 'ARTICLE 8', 'GENERAL PROVISIONS',
    '8.1 Entire Agreement. This Agreement constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, and agreements.\n\n8.2 Amendments. This Agreement may not be modified except by a written instrument signed by both parties.\n\n8.3 Severability. If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall remain in full force and effect.\n\n8.4 Notices. All notices shall be in writing and delivered personally, by certified mail, or by overnight courier to the addresses set forth herein.\n\n8.5 Section 409A Compliance. This Agreement is intended to comply with Section 409A of the Internal Revenue Code and shall be interpreted accordingly. Any payments subject to Section 409A that are payable upon termination of employment shall be paid only upon a "separation from service" as defined under Section 409A.');

  signatureBlock(doc, [
    { name: 'NOVATECH SOLUTIONS INC.', signatory: 'Dr. Anita Krishnamurthy', title: 'Chief Technology Officer' },
    { name: 'EMPLOYEE', signatory: 'Marcus J. Whitfield', title: 'Individual' },
  ]);

  finalize(doc);
  console.log('  [4/8] 04_Employment_Agreement.pdf');
}

// ── Document E: LLC Operating Agreement ─────────────────────────────────────

function generateLLC() {
  const { doc } = createDoc('05_LLC_Operating_Agreement.pdf');
  addHeader(doc, 'COASTAL CAPITAL PARTNERS LLC', '400 Royal Palm Way, Suite 600 | Palm Beach, FL 33480 | EIN: 84-3291547');

  title(doc, 'LIMITED LIABILITY COMPANY OPERATING AGREEMENT\nOF\nCOASTAL CAPITAL PARTNERS LLC');
  body(doc, 'This Limited Liability Company Operating Agreement (the "Agreement") of Coastal Capital Partners LLC, a Florida limited liability company (the "Company"), is entered into as of January 1, 2026 (the "Effective Date"), by and among the Members identified on Exhibit A attached hereto.');

  numberedSection(doc, 'ARTICLE I', 'FORMATION AND PURPOSE',
    '1.1 Formation. The Company was formed as a Florida limited liability company by filing Articles of Organization with the Florida Department of State, Division of Corporations, on November 15, 2025, under Document Number L25000345678.\n\n1.2 Name. The name of the Company is Coastal Capital Partners LLC.\n\n1.3 Principal Office. The principal office of the Company shall be located at 400 Royal Palm Way, Suite 600, Palm Beach, FL 33480, or such other place as the Managing Members may determine.\n\n1.4 Registered Agent. The registered agent of the Company is Corporation Service Company, 1201 Hays Street, Tallahassee, FL 32301.\n\n1.5 Purpose. The purpose of the Company is to: (a) identify, evaluate, acquire, manage, and dispose of real estate investments, private equity interests, and other investment assets; (b) provide investment advisory and wealth management services; (c) engage in any other lawful business permitted under the Florida Revised Limited Liability Company Act (the "Act"); and (d) do all things necessary or incidental to the foregoing.\n\n1.6 Term. The Company shall have perpetual existence unless dissolved in accordance with Article X of this Agreement.');

  numberedSection(doc, 'ARTICLE II', 'MEMBERS AND CAPITAL CONTRIBUTIONS',
    '2.1 Initial Members. The initial Members of the Company, their capital contributions, and their respective Membership Interests (expressed as percentages) are set forth on Exhibit A.\n\n    Alexander R. Prescott — $2,500,000.00 — 50.0%\n    Diana L. Thornton — $1,250,000.00 — 25.0%\n    Robert K. Vasquez — $750,000.00 — 15.0%\n    Elena M. Fontaine — $500,000.00 — 10.0%\n\n    Total Capital: $5,000,000.00\n\n2.2 Additional Capital Contributions. No Member shall be required to make additional capital contributions without such Member\'s written consent. The Managing Members may request additional capital contributions pro rata to existing Membership Interests, and Members who fail to contribute within thirty (30) days shall be subject to dilution as provided in Section 2.4.\n\n2.3 Capital Accounts. A separate capital account shall be maintained for each Member in accordance with Treasury Regulation Section 1.704-1(b)(2)(iv).\n\n2.4 Dilution. If a Member fails to make a required additional capital contribution within thirty (30) days of written notice, the Contributing Members may advance such Member\'s share. The non-contributing Member\'s Membership Interest shall be diluted proportionally, calculated using the formula: Adjusted % = (Original Contribution / Total Capital After Dilution) × 100.');

  numberedSection(doc, 'ARTICLE III', 'MANAGEMENT AND GOVERNANCE',
    '3.1 Member-Managed. The Company shall be managed by its Members. The Managing Members shall be Alexander R. Prescott and Diana L. Thornton, who shall have the authority to manage the day-to-day affairs of the Company.\n\n3.2 Voting. Except as otherwise provided herein, all decisions of the Company shall require the affirmative vote of Members holding more than fifty percent (50%) of the total Membership Interests. The following actions shall require the affirmative vote of Members holding at least seventy-five percent (75%) of the total Membership Interests: (a) admission of new Members; (b) amendment of this Agreement; (c) merger, consolidation, or sale of all or substantially all Company assets; (d) incurrence of indebtedness exceeding Five Hundred Thousand Dollars ($500,000.00); (e) dissolution of the Company; and (f) any single capital expenditure exceeding Two Hundred Fifty Thousand Dollars ($250,000.00).\n\n3.3 Meetings. The Members shall hold at least one (1) annual meeting and such additional meetings as may be called by any Managing Member upon ten (10) days\' written notice.\n\n3.4 Officers. The Managing Members may appoint officers of the Company, including a Chief Financial Officer, General Counsel, and such other officers as deemed necessary.');

  numberedSection(doc, 'ARTICLE IV', 'PAYMENT TERMS — DISTRIBUTIONS AND ALLOCATIONS',
    '4.1 Distributions. Distributions of Available Cash (as defined below) shall be made quarterly, within thirty (30) days following the end of each fiscal quarter, in the following order of priority (the "Distribution Waterfall"):\n\n    (a) First, to all Members pro rata to their Membership Interests until each Member has received cumulative distributions equal to their capital contributions (the "Return of Capital");\n    (b) Second, to all Members pro rata to their Membership Interests until each Member has received a preferred return of eight percent (8%) per annum on unreturned capital contributions (the "Preferred Return");\n    (c) Third, twenty percent (20%) to the Managing Members as a carried interest ("Carry"), and eighty percent (80%) to all Members pro rata to their Membership Interests.\n\n4.2 Available Cash. "Available Cash" means the gross cash receipts of the Company less: (a) operating expenses; (b) debt service payments; (c) reserves for future obligations as determined by the Managing Members (not to exceed twenty percent (20%) of gross receipts); and (d) capital expenditures.\n\n4.3 Tax Distributions. Notwithstanding Section 4.1, the Company shall make tax distributions to each Member in an amount sufficient to cover each Member\'s estimated federal and state income tax liability attributable to the Company\'s taxable income allocated to such Member, based on the highest marginal individual tax rate.\n\n4.4 Allocation of Profits and Losses. Profits and losses shall be allocated to the Members in accordance with their Membership Interests, subject to the requirements of Sections 704(b) and 704(c) of the Internal Revenue Code and the regulations thereunder.');

  numberedSection(doc, 'ARTICLE V', 'TRANSFER OF INTERESTS',
    '5.1 Restrictions on Transfer. No Member may transfer, sell, assign, pledge, or otherwise encumber all or any portion of its Membership Interest without the prior written consent of Members holding at least seventy-five percent (75%) of the total Membership Interests, except as provided in this Article V.\n\n5.2 Right of First Refusal. Before transferring any Membership Interest to a third party, the transferring Member must first offer the interest to the remaining Members pro rata to their Membership Interests at the same price and on the same terms offered by the third party. The remaining Members shall have thirty (30) days to accept or decline the offer.\n\n5.3 Permitted Transfers. A Member may transfer its Membership Interest without the consent of other Members to: (a) a revocable trust for the benefit of the transferring Member or such Member\'s immediate family; (b) a family limited partnership wholly owned by the Member and/or the Member\'s immediate family; or (c) an entity wholly owned and controlled by the transferring Member.\n\n5.4 Tag-Along Rights. If a Managing Member proposes to sell more than fifty percent (50%) of its Membership Interest to a third party, each non-Managing Member shall have the right to sell its proportionate share of its Membership Interest to such third party on the same terms and conditions.\n\n5.5 Drag-Along Rights. If Members holding seventy-five percent (75%) or more of the total Membership Interests agree to sell all of their interests to a bona fide third-party purchaser, they may require all remaining Members to sell their interests on the same terms.');

  numberedSection(doc, 'ARTICLE VI', 'BOOKS, RECORDS, AND REPORTING',
    '6.1 Books and Records. The Company shall maintain complete and accurate books and records of account at its principal office, in accordance with generally accepted accounting principles (GAAP).\n\n6.2 Financial Reporting. The Company shall provide to each Member: (a) audited annual financial statements within ninety (90) days of the end of each fiscal year; (b) unaudited quarterly financial statements within thirty (30) days of the end of each quarter; and (c) Schedule K-1 tax information within seventy-five (75) days of the end of each fiscal year.\n\n6.3 Right to Inspect. Each Member shall have the right, upon reasonable notice, to inspect and copy the Company\'s books and records during normal business hours.');

  numberedSection(doc, 'ARTICLE VII', 'INDEMNIFICATION AND LIABILITY',
    '7.1 Indemnification. The Company shall indemnify and hold harmless each Member, Managing Member, officer, and their respective agents, employees, and affiliates (each, an "Indemnified Person") from and against any and all losses, claims, damages, liabilities, judgments, fines, penalties, and reasonable expenses (including attorneys\' fees) arising out of or related to such Indemnified Person\'s activities on behalf of the Company, to the fullest extent permitted by the Act, except to the extent caused by such person\'s gross negligence, willful misconduct, or breach of fiduciary duty.\n\n7.2 Limitation of Liability. No Member shall be personally liable for the debts, obligations, or liabilities of the Company solely by reason of being a Member. The liability of each Member shall be limited to such Member\'s capital contribution and any distributions received in violation of this Agreement or the Act.\n\n7.3 Insurance. The Company shall maintain directors\' and officers\' liability insurance with coverage limits of not less than Three Million Dollars ($3,000,000.00).');

  numberedSection(doc, 'ARTICLE VIII', 'CONFIDENTIALITY',
    '8.1 Confidentiality. Each Member agrees that all Confidential Information shall be kept strictly confidential and shall not be disclosed to any third party without the prior written consent of the Managing Members, except: (a) to such Member\'s attorneys, accountants, and financial advisors who are bound by professional confidentiality obligations; (b) as required by law or regulation; or (c) in connection with the enforcement of such Member\'s rights under this Agreement.\n\n8.2 "Confidential Information" includes, without limitation: (a) the financial performance, investment strategy, and portfolio holdings of the Company; (b) the terms of this Agreement; (c) the identity of the Company\'s investors, partners, and counterparties; (d) proprietary investment models, algorithms, and analytical tools; and (e) any information designated as confidential by the Managing Members.');

  numberedSection(doc, 'ARTICLE IX', 'FIDUCIARY DUTIES',
    '9.1 Duty of Loyalty. Each Managing Member owes a duty of loyalty to the Company and shall not compete with the Company or engage in self-dealing transactions without full disclosure and the approval of Members holding at least seventy-five percent (75%) of the non-interested Membership Interests.\n\n9.2 Duty of Care. Each Managing Member shall exercise reasonable care and diligence in managing the affairs of the Company.\n\n9.3 Business Opportunities. The Managing Members shall present to the Company any business opportunity that falls within the Company\'s stated purpose before pursuing such opportunity individually.');

  numberedSection(doc, 'ARTICLE X', 'DISSOLUTION AND TERMINATION',
    '10.1 Dissolution Events. The Company shall be dissolved upon the occurrence of any of the following: (a) the written consent of Members holding at least seventy-five percent (75%) of the total Membership Interests; (b) a judicial decree of dissolution; (c) the entry of a decree of administrative dissolution by the Florida Department of State; or (d) the sale or disposition of all or substantially all of the Company\'s assets.\n\n10.2 Winding Up. Upon dissolution, the Managing Members (or a liquidating trustee appointed by the Members) shall wind up the affairs of the Company and distribute the assets in the following order: (a) payment of debts and liabilities to creditors; (b) setting aside reserves for contingent liabilities; (c) return of capital contributions to Members; and (d) distribution of remaining assets to Members pro rata to their Membership Interests.\n\n10.3 Termination. The Company shall terminate upon the completion of winding up and the filing of Articles of Dissolution with the Florida Department of State.');

  numberedSection(doc, 'ARTICLE XI', 'GOVERNING LAW AND DISPUTE RESOLUTION',
    '11.1 Governing Law. This Agreement shall be governed by and construed in accordance with the laws of the State of Florida, including the Florida Revised Limited Liability Company Act.\n\n11.2 Jurisdiction. Any action arising out of or relating to this Agreement shall be brought exclusively in the state or federal courts located in Palm Beach County, Florida.\n\n11.3 Mediation and Arbitration. Prior to initiating litigation, the Members agree to attempt to resolve any dispute through mediation conducted by a mutually agreed mediator. If mediation is unsuccessful within thirty (30) days, the dispute shall be submitted to binding arbitration in West Palm Beach, Florida, under the rules of the American Arbitration Association.\n\n11.4 Attorneys\' Fees. In any action to enforce this Agreement, the prevailing party shall be entitled to recover its reasonable attorneys\' fees and costs from the non-prevailing party.');

  signatureBlock(doc, [
    { name: 'MEMBER', signatory: 'Alexander R. Prescott', title: 'Managing Member (50.0%)' },
    { name: 'MEMBER', signatory: 'Diana L. Thornton', title: 'Managing Member (25.0%)' },
    { name: 'MEMBER', signatory: 'Robert K. Vasquez', title: 'Member (15.0%)' },
    { name: 'MEMBER', signatory: 'Elena M. Fontaine', title: 'Member (10.0%)' },
  ]);

  finalize(doc);
  console.log('  [5/8] 05_LLC_Operating_Agreement.pdf');
}

// ── Document F: Data Processing Agreement ───────────────────────────────────

function generateDPA() {
  const { doc } = createDoc('06_Data_Processing_Agreement.pdf');
  addHeader(doc, 'MEDCORE ANALYTICS INC.', '200 CentrePort Drive, Suite 350 | Greensboro, NC 27409 | (336) 555-0217');

  title(doc, 'DATA PROCESSING AGREEMENT');
  body(doc, 'This Data Processing Agreement ("DPA") is entered into as of February 10, 2026 (the "Effective Date"), by and between:');
  body(doc, 'MEDCORE ANALYTICS INC., a North Carolina corporation ("Controller"), with its principal place of business at 200 CentrePort Drive, Suite 350, Greensboro, NC 27409; and');
  body(doc, 'RAGB\u00d6X PLATFORM SERVICES, a Delaware limited liability company ("Processor"), with its principal place of business at 1200 Brickell Avenue, Suite 2100, Miami, FL 33131.');
  body(doc, 'This DPA supplements and is incorporated into the Master Services Agreement dated January 5, 2026, between the Parties (the "MSA"). In the event of a conflict between this DPA and the MSA, this DPA shall prevail with respect to data processing matters.');

  numberedSection(doc, '1', 'DEFINITIONS',
    '1.1 "Personal Data" means any information relating to an identified or identifiable natural person, including Protected Health Information ("PHI") as defined by HIPAA, and personal data as defined under GDPR, CCPA, and other applicable data protection laws.\n\n1.2 "Processing" means any operation performed on Personal Data, including collection, recording, organization, structuring, storage, adaptation, retrieval, consultation, use, disclosure by transmission, dissemination, erasure, or destruction.\n\n1.3 "Data Subject" means the identified or identifiable natural person to whom the Personal Data relates.\n\n1.4 "Sub-Processor" means any third party engaged by Processor to process Personal Data on behalf of Controller.\n\n1.5 "Data Breach" means any accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to Personal Data.');

  numberedSection(doc, '2', 'SCOPE AND PURPOSE OF PROCESSING',
    '2.1 Subject Matter. Processor shall process Personal Data on behalf of Controller solely for the purpose of providing the services described in the MSA, including: (a) document ingestion, OCR processing, and text extraction; (b) embedding generation and vector storage for retrieval-augmented generation; (c) AI-assisted query processing and response generation; and (d) audit logging and compliance reporting.\n\n2.2 Categories of Data. The Personal Data processed under this DPA may include: (a) patient names, dates of birth, and medical record numbers; (b) clinical notes, diagnostic codes, and treatment plans; (c) insurance information and billing records; (d) employee names, contact information, and professional credentials; and (e) metadata associated with document processing.\n\n2.3 Duration. Processing shall continue for the duration of the MSA, plus ninety (90) days for orderly data return or deletion.');

  numberedSection(doc, '3', 'OBLIGATIONS OF PROCESSOR',
    '3.1 Processing Instructions. Processor shall process Personal Data only in accordance with Controller\'s documented instructions. If Processor believes that any instruction would violate applicable data protection law, Processor shall immediately inform Controller.\n\n3.2 Confidentiality. Processor shall ensure that all personnel authorized to process Personal Data are bound by written obligations of confidentiality and have received appropriate training in data protection.\n\n3.3 Security Measures. Processor shall implement and maintain appropriate technical and organizational security measures, including: (a) AES-256 encryption at rest for all stored Personal Data; (b) TLS 1.3 encryption in transit; (c) role-based access controls with multi-factor authentication; (d) SOC 2 Type II certified infrastructure; (e) automated intrusion detection and monitoring; (f) regular vulnerability scanning and penetration testing; and (g) secure data backup with geographic redundancy.\n\n3.4 Data Minimization. Processor shall process only the minimum amount of Personal Data necessary to fulfill the processing purposes described herein.');

  numberedSection(doc, '4', 'SUB-PROCESSING',
    '4.1 Prior Authorization. Processor shall not engage any Sub-Processor without the prior written consent of Controller. Controller hereby approves the Sub-Processors listed in Annex B.\n\n4.2 Sub-Processor Obligations. Processor shall ensure that each Sub-Processor is bound by data protection obligations no less protective than those set forth in this DPA.\n\n4.3 Approved Sub-Processors. The following Sub-Processors are approved as of the Effective Date:\n    - Google Cloud Platform (Infrastructure hosting, US regions only)\n    - Cloud SQL for PostgreSQL (Database storage, us-east4)\n    - Vertex AI (AI model inference, no data retention)\n\n4.4 Changes. Processor shall provide Controller with thirty (30) days\' prior written notice before adding or replacing any Sub-Processor. Controller may object within fifteen (15) days on reasonable data protection grounds.');

  numberedSection(doc, '5', 'DATA SUBJECT RIGHTS',
    'Processor shall promptly assist Controller in responding to requests from Data Subjects exercising their rights under applicable data protection law, including rights of access, rectification, erasure, data portability, and objection to processing. Processor shall respond to Controller\'s requests within five (5) business days.');

  numberedSection(doc, '6', 'DATA BREACH NOTIFICATION',
    '6.1 Notification. In the event of a Data Breach, Processor shall notify Controller without undue delay, and in any event within twenty-four (24) hours of becoming aware of the breach.\n\n6.2 Information. The notification shall include: (a) a description of the nature of the breach; (b) the categories and approximate number of Data Subjects affected; (c) the likely consequences of the breach; (d) the measures taken or proposed to address the breach; and (e) the contact details of the Processor\'s data protection officer.\n\n6.3 Cooperation. Processor shall cooperate fully with Controller in investigating and remediating the breach and in meeting any applicable regulatory notification obligations.');

  numberedSection(doc, '7', 'PAYMENT TERMS',
    '7.1 Processing Fees. Controller shall pay Processor the processing fees set forth in the MSA. The current fee schedule provides for: (a) platform subscription of Eight Thousand Five Hundred Dollars ($8,500.00) per month; (b) per-document processing fee of $0.15 per page for OCR and extraction; (c) query processing at $0.02 per query; and (d) storage at $0.50 per GB per month.\n\n7.2 Audit Costs. Each Party shall bear its own costs in connection with audits conducted under Section 8, unless an audit reveals a material breach by Processor, in which case Processor shall bear the reasonable costs of the audit.\n\n7.3 Data Return/Deletion Costs. The costs of data return or deletion upon termination shall be borne by Controller, not to exceed Five Thousand Dollars ($5,000.00).');

  numberedSection(doc, '8', 'AUDITS AND COMPLIANCE',
    '8.1 Audit Rights. Controller shall have the right to audit Processor\'s compliance with this DPA, including inspections of Processor\'s facilities and systems, upon thirty (30) days\' prior written notice and during normal business hours.\n\n8.2 Certifications. Processor shall maintain SOC 2 Type II certification and shall provide Controller with copies of the most recent audit report upon request.\n\n8.3 HIPAA Compliance. To the extent Processor processes PHI on behalf of Controller, the Parties shall enter into a Business Associate Agreement ("BAA") that complies with HIPAA and the HITECH Act.');

  numberedSection(doc, '9', 'INDEMNIFICATION',
    '9.1 Indemnification by Processor. Processor shall indemnify, defend, and hold harmless Controller from any losses, damages, fines, penalties, and reasonable expenses (including attorneys\' fees) arising from: (a) Processor\'s breach of this DPA; (b) Processor\'s processing of Personal Data in violation of Controller\'s instructions or applicable law; or (c) any Data Breach caused by Processor\'s failure to implement adequate security measures.\n\n9.2 Limitation. Processor\'s aggregate liability under this DPA shall not exceed two (2) times the annual fees paid by Controller under the MSA, except in cases of willful misconduct or gross negligence.');

  numberedSection(doc, '10', 'TERMINATION AND DATA RETURN',
    '10.1 Termination. This DPA shall terminate upon the termination or expiration of the MSA.\n\n10.2 Data Return. Upon termination, Processor shall, at Controller\'s election: (a) return all Personal Data to Controller in a commonly used, machine-readable format within thirty (30) days; or (b) securely delete all Personal Data and certify such deletion in writing.\n\n10.3 Survival. The confidentiality and security obligations of this DPA shall survive termination for a period of three (3) years.');

  numberedSection(doc, '11', 'GOVERNING LAW AND JURISDICTION',
    '11.1 Governing Law. This DPA shall be governed by and construed in accordance with the laws of the State of North Carolina.\n\n11.2 Jurisdiction. Any dispute arising under this DPA shall be resolved in the state or federal courts located in Guilford County, North Carolina.');

  signatureBlock(doc, [
    { name: 'MEDCORE ANALYTICS INC. (Controller)', signatory: 'Dr. Sarah L. Wainwright', title: 'Chief Privacy Officer' },
    { name: 'RAGB\u00d6X PLATFORM SERVICES (Processor)', signatory: 'David Hurtado', title: 'Chief Executive Officer' },
  ]);

  finalize(doc);
  console.log('  [6/8] 06_Data_Processing_Agreement.pdf');
}

// ── Document G: Consulting Services Agreement ───────────────────────────────

function generateConsulting() {
  const { doc } = createDoc('07_Consulting_Services_Agreement.pdf');
  addHeader(doc, 'PINNACLE FINANCIAL PARTNERS INC.', '150 Fourth Avenue North, Suite 900 | Nashville, TN 37219 | (615) 555-0433');

  title(doc, 'CONSULTING SERVICES AGREEMENT');
  body(doc, 'This Consulting Services Agreement ("Agreement") is entered into as of February 15, 2026 (the "Effective Date"), by and between:');
  body(doc, 'PINNACLE FINANCIAL PARTNERS INC., a Tennessee corporation ("Client"), with its principal place of business at 150 Fourth Avenue North, Suite 900, Nashville, TN 37219; and');
  body(doc, 'STERLING ADVISORY GROUP LLC, a Delaware limited liability company ("Consultant"), with its principal place of business at 1735 Market Street, Suite 2800, Philadelphia, PA 19103.');

  numberedSection(doc, '1', 'SCOPE OF SERVICES',
    '1.1 Services. Consultant shall provide the following advisory and consulting services to Client (collectively, the "Services"):\n\n(a) Regulatory Compliance Assessment: A comprehensive review of Client\'s compliance framework with respect to the Dodd-Frank Act, Bank Secrecy Act/Anti-Money Laundering (BSA/AML), Consumer Financial Protection Bureau (CFPB) regulations, and the Community Reinvestment Act (CRA);\n\n(b) Risk Management Enhancement: Development and implementation of an enterprise risk management ("ERM") framework, including credit risk modeling, operational risk assessment, and market risk analytics;\n\n(c) Technology Modernization Advisory: Strategic assessment of Client\'s core banking systems, digital transformation roadmap, and fintech integration opportunities;\n\n(d) Board Governance Advisory: Preparation of board presentations, regulatory exam preparation, and corporate governance best practices documentation; and\n\n(e) Training and Knowledge Transfer: Up to forty (40) hours of on-site training sessions for Client\'s compliance, risk, and technology teams.\n\n1.2 Deliverables. Consultant shall deliver the following written deliverables ("Deliverables") on the schedule set forth in Exhibit A:\n\n    Phase 1 — Compliance Gap Analysis Report (Week 4)\n    Phase 2 — ERM Framework Documentation (Week 8)\n    Phase 3 — Technology Assessment and Roadmap (Week 12)\n    Phase 4 — Final Recommendations Report (Week 16)\n    Phase 5 — Training Materials and Playbooks (Week 18)');

  numberedSection(doc, '2', 'PAYMENT TERMS AND FEES',
    '2.1 Fixed Fee. Client shall pay Consultant a total fixed fee of Four Hundred Seventy-Five Thousand Dollars ($475,000.00) for the Services, payable as follows:\n\n    (a) Twenty-five percent (25%) — $118,750.00 — upon execution of this Agreement;\n    (b) Twenty-five percent (25%) — $118,750.00 — upon delivery and acceptance of Phase 2 Deliverables;\n    (c) Twenty-five percent (25%) — $118,750.00 — upon delivery and acceptance of Phase 4 Deliverables;\n    (d) Twenty-five percent (25%) — $118,750.00 — upon delivery and acceptance of all Deliverables.\n\n2.2 Additional Services. Any services requested by Client beyond the scope of this Agreement shall be provided at the following hourly rates:\n\n    Senior Partners: $750.00 per hour\n    Directors: $550.00 per hour\n    Senior Consultants: $400.00 per hour\n    Analysts: $275.00 per hour\n\n2.3 Expenses. Client shall reimburse Consultant for reasonable travel and out-of-pocket expenses incurred in connection with the Services, subject to Client\'s expense policy and a monthly cap of Fifteen Thousand Dollars ($15,000.00). Air travel shall be coach class for flights under four (4) hours; business class is permitted for longer flights.\n\n2.4 Payment Terms. All invoices are due and payable within thirty (30) days of receipt. Late payments shall bear interest at the rate of one percent (1%) per month or the maximum rate permitted by law, whichever is less.\n\n2.5 Taxes. All fees are exclusive of applicable sales, use, and value-added taxes, which shall be the responsibility of Client.');

  numberedSection(doc, '3', 'TERM AND TERMINATION',
    '3.1 Term. This Agreement shall commence on the Effective Date and shall continue until the earlier of: (a) the completion of all Services and acceptance of all Deliverables; or (b) eighteen (18) months from the Effective Date (the "Term").\n\n3.2 Termination for Convenience. Either Party may terminate this Agreement for any reason upon thirty (30) days\' prior written notice to the other Party.\n\n3.3 Termination for Cause. Either Party may terminate this Agreement immediately upon written notice if the other Party: (a) materially breaches any provision of this Agreement and fails to cure such breach within fifteen (15) days after written notice; (b) becomes insolvent or files a petition in bankruptcy; or (c) is found to have engaged in fraud, willful misconduct, or illegal activity.\n\n3.4 Effect of Termination. Upon termination: (a) Consultant shall deliver all completed and in-progress Deliverables to Client; (b) Client shall pay Consultant for all Services performed and expenses incurred through the effective date of termination; (c) if Client terminates for convenience, Client shall pay a termination fee equal to ten percent (10%) of the unearned portion of the fixed fee; and (d) all confidentiality obligations shall survive termination.\n\n3.5 Transition Assistance. Upon termination or expiration, Consultant shall provide reasonable transition assistance for a period of up to thirty (30) days at Consultant\'s then-current hourly rates.');

  numberedSection(doc, '4', 'CONFIDENTIALITY',
    '4.1 Definition. "Confidential Information" means any non-public information disclosed by one Party ("Discloser") to the other Party ("Recipient") in connection with this Agreement, including business plans, financial information, customer data, regulatory examination reports, technology systems, security protocols, and any information marked or designated as confidential.\n\n4.2 Obligations. Recipient shall: (a) use Confidential Information solely for the purposes of this Agreement; (b) protect Confidential Information using at least the same degree of care as it uses for its own confidential information, but no less than reasonable care; (c) not disclose Confidential Information to any third party without Discloser\'s prior written consent; and (d) limit access to Confidential Information to those employees and contractors with a need to know who are bound by confidentiality obligations no less restrictive than those herein.\n\n4.3 Regulatory Confidentiality. Consultant acknowledges that certain information provided by Client, including regulatory examination reports and correspondence with banking regulators, is subject to heightened confidentiality requirements under federal and state banking laws. Consultant shall not disclose such information to any third party under any circumstances without Client\'s prior written consent and applicable regulatory approval.\n\n4.4 Duration. Confidentiality obligations shall survive the termination or expiration of this Agreement for a period of five (5) years, provided that obligations with respect to trade secrets shall continue indefinitely.');

  numberedSection(doc, '5', 'INTELLECTUAL PROPERTY',
    '5.1 Client Ownership. All Deliverables created by Consultant specifically for Client under this Agreement shall be the property of Client. Consultant hereby assigns to Client all right, title, and interest in the Deliverables.\n\n5.2 Consultant Tools. Notwithstanding Section 5.1, Consultant retains all rights in its pre-existing methodologies, frameworks, tools, templates, and know-how ("Consultant Tools"). To the extent Consultant Tools are incorporated into Deliverables, Consultant grants Client a non-exclusive, perpetual, royalty-free license to use such Consultant Tools solely in connection with the Deliverables.\n\n5.3 Feedback. Any feedback, suggestions, or improvements proposed by Client regarding Consultant Tools shall not create any intellectual property rights in favor of Client.');

  numberedSection(doc, '6', 'INDEMNIFICATION',
    '6.1 Indemnification by Consultant. Consultant shall indemnify, defend, and hold harmless Client and its directors, officers, employees, and agents from and against any and all claims, losses, damages, liabilities, and expenses (including reasonable attorneys\' fees) arising out of or related to: (a) Consultant\'s breach of this Agreement; (b) Consultant\'s negligence or willful misconduct; (c) any infringement of third-party intellectual property rights by the Deliverables; or (d) any violation of applicable law by Consultant in performing the Services.\n\n6.2 Indemnification by Client. Client shall indemnify, defend, and hold harmless Consultant and its members, managers, employees, and agents from and against any and all claims, losses, damages, liabilities, and expenses arising out of or related to: (a) Client\'s breach of this Agreement; (b) Client\'s use of the Deliverables; or (c) any inaccurate or incomplete information provided by Client.\n\n6.3 Limitation of Liability. EXCEPT FOR BREACHES OF CONFIDENTIALITY OR INDEMNIFICATION OBLIGATIONS, NEITHER PARTY SHALL BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES. CONSULTANT\'S TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE TOTAL FEES PAID OR PAYABLE UNDER THIS AGREEMENT.');

  numberedSection(doc, '7', 'REPRESENTATIONS AND WARRANTIES',
    '7.1 Consultant Warranties. Consultant represents and warrants that: (a) it has the authority to enter into this Agreement; (b) the Services will be performed in a professional and workmanlike manner consistent with industry standards; (c) its personnel have the qualifications, experience, and licenses necessary to perform the Services; (d) the Deliverables will not infringe any third-party intellectual property rights; and (e) it will comply with all applicable laws and regulations.\n\n7.2 Client Warranties. Client represents and warrants that: (a) it has the authority to enter into this Agreement; (b) it will provide timely access to information, personnel, and facilities necessary for Consultant to perform the Services; and (c) all information provided to Consultant will be accurate and complete in all material respects.');

  numberedSection(doc, '8', 'INDEPENDENT CONTRACTOR',
    'Consultant is an independent contractor and nothing in this Agreement shall create an employer-employee, partnership, joint venture, or agency relationship between the Parties. Consultant shall be solely responsible for all taxes, insurance, and benefits for its personnel.');

  numberedSection(doc, '9', 'GOVERNING LAW AND JURISDICTION',
    '9.1 Governing Law. This Agreement shall be governed by and construed in accordance with the laws of the State of Tennessee, without regard to its conflicts of law provisions.\n\n9.2 Jurisdiction. Any dispute arising under this Agreement shall be resolved exclusively in the state or federal courts located in Davidson County, Tennessee.\n\n9.3 Dispute Resolution. Prior to initiating any litigation, the Parties agree to participate in good-faith mediation in Nashville, Tennessee. If mediation does not resolve the dispute within forty-five (45) days, either Party may pursue its legal remedies.');

  numberedSection(doc, '10', 'GENERAL PROVISIONS',
    '10.1 Entire Agreement. This Agreement, including all exhibits, constitutes the entire agreement between the Parties.\n\n10.2 Amendments. This Agreement may be amended only by a written instrument signed by both Parties.\n\n10.3 Assignment. Neither Party may assign this Agreement without the prior written consent of the other Party, except in connection with a merger, acquisition, or sale of substantially all assets.\n\n10.4 Force Majeure. Neither Party shall be liable for delays caused by events beyond its reasonable control.\n\n10.5 Counterparts. This Agreement may be executed in counterparts.');

  signatureBlock(doc, [
    { name: 'PINNACLE FINANCIAL PARTNERS INC.', signatory: 'William T. Archer', title: 'Chief Operating Officer' },
    { name: 'STERLING ADVISORY GROUP LLC', signatory: 'Catherine R. DeLuca', title: 'Managing Partner' },
  ]);

  finalize(doc);
  console.log('  [7/8] 07_Consulting_Services_Agreement.pdf');
}

// ── Document H: Compliance Policy Manual ────────────────────────────────────

function generateCompliancePolicy() {
  const { doc } = createDoc('08_Compliance_Policy_Manual.pdf');
  addHeader(doc, 'HARGROVE & ASSOCIATES LLP', '1901 L Street NW, Suite 700 | Washington, DC 20036 | (202) 555-0566');

  title(doc, 'COMPLIANCE POLICY MANUAL\nDocument Retention & Information Security');
  doc.moveDown(0.3);
  doc.fontSize(9).font('Helvetica').text('Version 4.2 | Effective Date: January 1, 2026 | Approved by: Managing Partners Committee', { align: 'center' });
  doc.fontSize(9).text('Classification: CONFIDENTIAL — Internal Use Only', { align: 'center' });
  doc.moveDown(1);

  subtitle(doc, 'TABLE OF CONTENTS');
  body(doc, 'Part I — Document Retention Policy\n  Section 1: Purpose and Scope\n  Section 2: Retention Schedule\n  Section 3: Electronic Records Management\n  Section 4: Legal Holds\n  Section 5: Destruction Procedures\n\nPart II — Information Security Policy\n  Section 6: Access Controls\n  Section 7: Data Classification\n  Section 8: Incident Response\n  Section 9: Third-Party Security\n  Section 10: Employee Obligations\n\nPart III — Enforcement and Compliance\n  Section 11: Training Requirements\n  Section 12: Monitoring and Auditing\n  Section 13: Disciplinary Actions\n  Section 14: Policy Review and Updates');

  doc.addPage();
  addHeader(doc, 'HARGROVE & ASSOCIATES LLP', '1901 L Street NW, Suite 700 | Washington, DC 20036 | (202) 555-0566');

  title(doc, 'PART I — DOCUMENT RETENTION POLICY');

  numberedSection(doc, 'Section 1', 'PURPOSE AND SCOPE',
    '1.1 Purpose. This Document Retention Policy ("Policy") establishes the requirements for the retention, management, and destruction of all documents and records created, received, or maintained by Hargrove & Associates LLP (the "Firm") in the course of its business operations and legal practice.\n\n1.2 Scope. This Policy applies to all partners, associates, of counsel, paralegals, staff, contractors, and any other individuals who create, access, or manage Firm records, regardless of format (paper, electronic, audio, video, or other media).\n\n1.3 Legal Basis. This Policy is designed to comply with applicable federal and state laws, regulations, and professional obligations, including: (a) the Sarbanes-Oxley Act; (b) the Federal Rules of Civil Procedure; (c) IRS record retention requirements; (d) state bar ethics rules governing attorney record-keeping; and (e) SEC Rule 17a-4 (where applicable to regulated clients).\n\n1.4 Definitions. "Document" or "Record" means any recorded information, regardless of form or characteristics, including correspondence, memoranda, contracts, reports, emails, instant messages, spreadsheets, databases, voicemails, photographs, and metadata.');

  numberedSection(doc, 'Section 2', 'RETENTION SCHEDULE',
    '2.1 General Retention Periods. The following minimum retention periods shall apply:\n\n    Document Category                          Retention Period\n    ─────────────────────────────────────────────────────────────\n    Client engagement letters                  Permanent\n    Client matter files (active)               Duration of engagement + 7 years\n    Client matter files (closed)               10 years from matter closing\n    Privileged communications                  Permanent (unless waived)\n    Corporate formation documents              Permanent\n    Financial records and tax returns           7 years\n    Employee personnel records                 7 years after termination\n    Contracts and agreements                    10 years after expiration\n    Billing records and invoices               7 years\n    Trust account records (IOTA)               7 years\n    Marketing materials                        3 years\n    General correspondence                     5 years\n    Internal memoranda                         5 years\n    Board/partner meeting minutes              Permanent\n    Insurance policies                         Permanent\n    Real estate records                        Permanent\n    Litigation files                           10 years after final disposition\n    Regulatory filings                         Permanent\n\n2.2 Electronic Records. Electronic records are subject to the same retention periods as their paper equivalents. Email messages that constitute substantive business records must be preserved in accordance with this schedule.\n\n2.3 Exceptions. The Chief Compliance Officer may authorize exceptions to the retention schedule for specific categories of records upon written request and with documented justification.');

  numberedSection(doc, 'Section 3', 'ELECTRONIC RECORDS MANAGEMENT',
    '3.1 Document Management System. All Firm documents shall be stored in the Firm\'s approved document management system (currently iManage Work). Documents stored outside the DMS are not subject to the Firm\'s backup and disaster recovery protections and may be subject to disciplinary action.\n\n3.2 Naming Conventions. All electronic documents shall follow the Firm\'s naming convention: [ClientNo]-[MatterNo]-[DocType]-[Description]-[YYYY-MM-DD].\n\n3.3 Email Management. Emails related to client matters must be filed in the appropriate matter folder within the DMS within five (5) business days of receipt or sending. Personal emails must not be stored in client matter folders.\n\n3.4 Cloud Storage. Use of personal cloud storage services (Dropbox, Google Drive, iCloud, etc.) for Firm or client documents is strictly prohibited. Only Firm-approved cloud services with appropriate security controls may be used.\n\n3.5 Mobile Devices. Client documents may be accessed on mobile devices only through Firm-approved secure applications with remote wipe capability.');

  numberedSection(doc, 'Section 4', 'LEGAL HOLDS',
    '4.1 Obligation to Preserve. When litigation is reasonably anticipated, pending, or ongoing, the Firm has a legal obligation to preserve all documents that may be relevant to the matter. The Chief Compliance Officer shall issue a written legal hold notice ("Legal Hold") to all custodians who may possess relevant documents.\n\n4.2 Scope of Legal Hold. A Legal Hold supersedes all retention schedules and destruction authorizations. No documents subject to a Legal Hold may be destroyed, deleted, modified, or transferred without the express written consent of the Chief Compliance Officer.\n\n4.3 Employee Obligations. Upon receiving a Legal Hold notice, each recipient must: (a) immediately cease any destruction of potentially relevant documents; (b) identify and segregate all responsive documents; (c) confirm receipt and compliance in writing within forty-eight (48) hours; and (d) continue to preserve documents until the Legal Hold is formally released.\n\n4.4 Penalties. Failure to comply with a Legal Hold may result in disciplinary action, up to and including termination, and may expose the Firm to sanctions, adverse inference instructions, or other legal penalties.');

  numberedSection(doc, 'Section 5', 'DESTRUCTION PROCEDURES',
    '5.1 Authorized Destruction. Documents that have reached the end of their retention period and are not subject to any Legal Hold may be destroyed in accordance with this Section.\n\n5.2 Destruction Methods. The following destruction methods are authorized:\n    Paper documents: Cross-cut shredding (DIN Level P-4 or higher)\n    Electronic media: NIST SP 800-88 compliant data sanitization\n    Hard drives: Physical destruction or degaussing\n    Optical media: Physical shredding\n\n5.3 Destruction Certificate. A written certificate of destruction must be prepared for each destruction event, documenting: (a) the date of destruction; (b) a description of the documents destroyed; (c) the method of destruction; (d) the identity of the person supervising destruction; and (e) confirmation that no Legal Hold applies.\n\n5.4 Third-Party Destruction. If destruction is performed by a third-party vendor, the vendor must execute a confidentiality agreement and provide a certificate of destruction.');

  doc.addPage();
  addHeader(doc, 'HARGROVE & ASSOCIATES LLP', '1901 L Street NW, Suite 700 | Washington, DC 20036 | (202) 555-0566');

  title(doc, 'PART II — INFORMATION SECURITY POLICY');

  numberedSection(doc, 'Section 6', 'ACCESS CONTROLS',
    '6.1 Principle of Least Privilege. Access to Firm systems and data shall be granted on a need-to-know basis, limited to the minimum level of access required to perform job functions.\n\n6.2 Authentication Requirements. All users must authenticate using multi-factor authentication (MFA) consisting of: (a) a unique username and strong password (minimum 14 characters, including uppercase, lowercase, numbers, and special characters); and (b) a second factor using a hardware security key (YubiKey) or approved authenticator application.\n\n6.3 Password Management. Passwords must be changed every ninety (90) days. Password reuse is prohibited for the previous twelve (12) passwords. Passwords must not be shared, written down, or stored in unencrypted form.\n\n6.4 Remote Access. Remote access to Firm systems is permitted only through the Firm\'s virtual private network (VPN) with split tunneling disabled. Remote desktop protocol (RDP) access from outside the VPN is prohibited.\n\n6.5 Privileged Accounts. Administrative and privileged accounts must be: (a) inventoried and reviewed quarterly; (b) subject to enhanced monitoring; (c) never used for routine tasks; and (d) protected by hardware MFA tokens.');

  numberedSection(doc, 'Section 7', 'DATA CLASSIFICATION',
    '7.1 Classification Levels. All Firm data shall be classified according to the following levels:\n\n    Level 1 — RESTRICTED: Attorney-client privileged communications, trade secrets, regulatory examination reports, client financial data, PII/PHI. Access limited to specifically authorized individuals.\n\n    Level 2 — CONFIDENTIAL: Client matter files, internal legal analyses, Firm financial records, personnel records, strategic plans. Access limited to Firm personnel with a business need.\n\n    Level 3 — INTERNAL: Internal policies, procedures, training materials, general correspondence. Available to all Firm personnel.\n\n    Level 4 — PUBLIC: Marketing materials, published articles, website content, press releases. No access restrictions.\n\n7.2 Labeling. All documents classified as RESTRICTED or CONFIDENTIAL must bear the appropriate classification label in the header or footer.\n\n7.3 Handling Requirements. Each classification level has specific handling requirements for storage, transmission, printing, and destruction as detailed in Appendix A.');

  numberedSection(doc, 'Section 8', 'INCIDENT RESPONSE',
    '8.1 Incident Response Team. The Firm maintains an Incident Response Team ("IRT") consisting of: (a) Chief Information Security Officer (Lead); (b) Chief Compliance Officer; (c) Managing Partner representative; (d) IT Director; and (e) outside cybersecurity counsel.\n\n8.2 Incident Classification. Security incidents are classified as follows:\n    Critical: Active data breach involving client data or privileged information\n    High: Ransomware, advanced persistent threat, or unauthorized system access\n    Medium: Malware infection, phishing compromise, or policy violation\n    Low: Suspicious activity, failed intrusion attempts, minor policy deviations\n\n8.3 Reporting. All personnel must report suspected security incidents to the IT Security team immediately upon discovery. The IRT shall be activated within one (1) hour for Critical and High incidents.\n\n8.4 Notification. In the event of a data breach involving client data, the Firm shall notify affected clients within seventy-two (72) hours of confirmation of the breach, and shall comply with all applicable state breach notification laws.\n\n8.5 Post-Incident Review. Following any Critical or High incident, the IRT shall conduct a post-incident review within thirty (30) days and document lessons learned, remediation actions, and preventive measures.');

  numberedSection(doc, 'Section 9', 'THIRD-PARTY SECURITY',
    '9.1 Vendor Assessment. Before engaging any third-party vendor that will access Firm systems or data, the IT Security team must complete a vendor security assessment covering: (a) SOC 2 Type II or equivalent certification; (b) encryption standards; (c) access controls; (d) incident response capabilities; and (e) data residency requirements.\n\n9.2 Contractual Requirements. All vendor agreements must include: (a) confidentiality and data protection obligations; (b) breach notification requirements (within twenty-four (24) hours); (c) audit rights; (d) data return and deletion provisions; and (e) compliance with applicable laws.\n\n9.3 Ongoing Monitoring. Third-party vendors with access to Level 1 or Level 2 data must be reassessed annually.');

  numberedSection(doc, 'Section 10', 'EMPLOYEE OBLIGATIONS AND CONFIDENTIALITY',
    '10.1 Acceptable Use. Firm computing resources are provided for business purposes. Limited personal use is permitted provided it does not: (a) interfere with job performance; (b) violate any Firm policy; (c) consume excessive bandwidth; or (d) expose the Firm to legal liability.\n\n10.2 Prohibited Activities. The following are strictly prohibited: (a) unauthorized access to systems or data; (b) installation of unauthorized software; (c) use of personal email for Firm business; (d) connecting unauthorized devices to the Firm network; (e) disabling security software; (f) sharing login credentials; and (g) circumventing access controls.\n\n10.3 Clean Desk Policy. All RESTRICTED and CONFIDENTIAL documents must be secured when unattended. Workstations must be locked when leaving the desk. Printing of RESTRICTED documents requires secure print release at the printer.\n\n10.4 Confidentiality Obligations. All personnel must maintain the confidentiality of client information, Firm proprietary information, and any information designated as confidential. These obligations continue after separation from the Firm.');

  doc.addPage();
  addHeader(doc, 'HARGROVE & ASSOCIATES LLP', '1901 L Street NW, Suite 700 | Washington, DC 20036 | (202) 555-0566');

  title(doc, 'PART III — ENFORCEMENT AND COMPLIANCE');

  numberedSection(doc, 'Section 11', 'TRAINING REQUIREMENTS',
    '11.1 Initial Training. All new personnel must complete the following training within thirty (30) days of hire: (a) Information Security Awareness (2 hours); (b) Document Retention and Records Management (1 hour); (c) Phishing Awareness and Social Engineering (1 hour); and (d) Ethics and Professional Responsibility (1 hour).\n\n11.2 Annual Refresher. All personnel must complete annual refresher training covering updated policies, emerging threats, and lessons learned from recent incidents.\n\n11.3 Specialized Training. Personnel in elevated-risk roles (IT administrators, compliance officers, partners handling regulatory matters) must complete additional role-specific training as determined by the Chief Compliance Officer.\n\n11.4 Training Records. All training completion records shall be maintained by the Human Resources department for the duration of employment plus seven (7) years.');

  numberedSection(doc, 'Section 12', 'MONITORING AND AUDITING',
    '12.1 System Monitoring. The Firm reserves the right to monitor all use of Firm computing resources, including email, internet access, file transfers, and system access logs. Personnel have no expectation of privacy when using Firm systems.\n\n12.2 Compliance Audits. The Chief Compliance Officer shall conduct annual compliance audits of: (a) document retention practices; (b) access control effectiveness; (c) employee training completion; (d) third-party vendor compliance; and (e) incident response readiness.\n\n12.3 External Audits. The Firm shall engage an independent third party to conduct a comprehensive information security assessment at least every two (2) years.\n\n12.4 Audit Reports. Audit findings shall be reported to the Managing Partners Committee within thirty (30) days of completion, with remediation plans for any identified deficiencies.');

  numberedSection(doc, 'Section 13', 'DISCIPLINARY ACTIONS',
    '13.1 Violations. Violations of this Policy may result in disciplinary action, up to and including: (a) verbal warning; (b) written warning; (c) suspension of system access; (d) suspension of employment; (e) termination of employment; and/or (f) referral for criminal prosecution.\n\n13.2 Severity Assessment. The severity of the disciplinary action shall be determined based on: (a) the nature and extent of the violation; (b) whether the violation was intentional or negligent; (c) the impact on clients, the Firm, or third parties; (d) prior violations; and (e) the individual\'s cooperation with the investigation.\n\n13.3 Reporting Violations. Personnel who become aware of policy violations must report them to the Chief Compliance Officer or through the Firm\'s anonymous ethics hotline. Retaliation against good-faith reporters is strictly prohibited.');

  numberedSection(doc, 'Section 14', 'POLICY REVIEW, UPDATES, AND TERMINATION CONDITIONS',
    '14.1 Annual Review. This Policy shall be reviewed at least annually by the Chief Compliance Officer and the Managing Partners Committee to ensure continued relevance and effectiveness.\n\n14.2 Updates. Updates to this Policy shall be communicated to all personnel via email and posted on the Firm\'s intranet. Material changes require approval by the Managing Partners Committee.\n\n14.3 Policy Termination. This Policy may be terminated or replaced only by a written resolution of the Managing Partners Committee. Upon termination of this Policy, all records subject to the retention schedule must continue to be retained until the applicable retention periods have expired.\n\n14.4 Questions. Questions regarding this Policy should be directed to:\n\n    Katherine M. Hargrove\n    Chief Compliance Officer\n    Hargrove & Associates LLP\n    khargrove@hargrovelaw.com\n    Direct: (202) 555-0571');

  numberedSection(doc, 'Section 15', 'GOVERNING LAW AND JURISDICTION',
    '15.1 Governing Law. This Policy and any disputes arising hereunder shall be governed by the laws of the District of Columbia.\n\n15.2 Jurisdiction. Any legal action related to this Policy shall be brought in the federal or state courts located in the District of Columbia.\n\n15.3 Indemnification. The Firm shall indemnify any partner, employee, or agent who, in good faith, takes action in furtherance of this Policy, including reporting suspected violations, issuing Legal Holds, or authorizing document destruction in accordance with the retention schedule, from and against any claims, damages, losses, and reasonable attorneys\' fees arising from such actions.');

  doc.moveDown(1);
  doc.fontSize(10).font('Helvetica-Bold').text('APPROVED AND ADOPTED:');
  doc.moveDown(1);
  doc.font('Helvetica').text('By: _________________________________');
  doc.text('Name: Katherine M. Hargrove');
  doc.text('Title: Chief Compliance Officer');
  doc.text('Date: January 1, 2026');
  doc.moveDown(1);
  doc.text('By: _________________________________');
  doc.text('Name: Thomas E. Hargrove III');
  doc.text('Title: Managing Partner');
  doc.text('Date: January 1, 2026');

  finalize(doc);
  console.log('  [8/8] 08_Compliance_Policy_Manual.pdf');
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('Generating 8 synthetic legal PDFs...\n');
generateNDA();
generateLease();
generateEngagementLetter();
generateEmployment();
generateLLC();
generateDPA();
generateConsulting();
generateCompliancePolicy();
console.log('\nDone. Files saved to: public/demo/legal-vault/');
