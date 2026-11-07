export const TERMS_VERSION = '1.0.0';
export const TERMS_STORAGE_KEY = '@inpand_terms_accepted_version';
export const TERMS_TIMESTAMP_KEY = '@inpand_terms_accepted_timestamp';

export interface TermsSection {
  id: number;
  title: string;
  content: string;
}

export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: 1,
    title: '1. Acceptance of Terms',
    content:
      'By downloading, installing, launching, or using Inpand Torrent ("the Software", "the Application", "we", "us", or "our"), you agree to be legally bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, do not install, access, or use the Software. Your continued use of the Software signifies your irrevocable acceptance of all provisions set forth herein.',
  },
  {
    id: 2,
    title: '2. Nature of the Software',
    content:
      'Inpand Torrent is an open-source-powered, decentralized Peer-to-Peer (P2P) BitTorrent client engineered for the Android operating system. The Software functions exclusively as a general-purpose communications protocol tool and data transfer utility. Inpand Torrent does not host, index, curate, verify, store, upload, distribute, or control any content, files, metadata, magnet links, or torrent data swarms accessed or transferred by its users.',
  },
  {
    id: 3,
    title: '3. User Responsibility & Lawful Use',
    content:
      'You bear sole and exclusive legal, moral, and regulatory responsibility for all content downloaded, seeded, uploaded, shared, cached, or accessed using the Software. You agree to use the Software strictly in full compliance with all applicable local, regional, national, and international laws, statutes, and treaties. You represent and warrant that you possess all requisite authorizations, rights, and licenses for any material you download, upload, or transfer via the BitTorrent protocol.',
  },
  {
    id: 4,
    title: '4. Prohibited Activities',
    content:
      'You are expressly prohibited from using Inpand Torrent to: (a) download, distribute, stream, or share copyrighted material without the express consent of the rights holder; (b) transfer, transmit, or store illicit, obscene, defamatory, harmful, or abusive content; (c) transmit malicious software, viruses, trojans, worms, ransomware, or spyware; (d) engage in activities that disrupt, degrade, or overburden network infrastructure or internet service provider (ISP) systems; or (e) violate export control laws or sanctions.',
  },
  {
    id: 5,
    title: '5. Intellectual Property Rights & Software Ownership',
    content:
      'All proprietary software source code, visual interfaces, graphic assets, logos, trademarks, and documentation comprising the Inpand Torrent application are owned by or licensed to Inpand Torrent and are protected under copyright and intellectual property legislation. Except as permitted under underlying open-source licenses, unauthorized modification, reverse engineering, decompilation, or redistribution of the proprietary packaging is strictly prohibited.',
  },
  {
    id: 6,
    title: '6. Disclaimer of Warranties (AS-IS)',
    content:
      'THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITH ALL FAULTS AND DEFECTS, WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED UNDER APPLICABLE LAW, INPAND TORRENT AND ITS DEVELOPERS, CONTRIBUTORS, AND AFFILIATES DISCLAIM ALL WARRANTIES, EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, FREEDOM FROM BUGS, AND UNINTERRUPTED ERROR-FREE OPERATION.',
  },
  {
    id: 7,
    title: '7. Limitation of Liability',
    content:
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL INPAND TORRENT, ITS AUTHORS, CONTRIBUTORS, OR AFFILIATES BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES (INCLUDING, WITHOUT LIMITATION, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, PROFITS, OR REVENUE; BUSINESS INTERRUPTION; OR ISP PENALTIES, BANDWIDTH SURCHARGES, COPYRIGHT CLAIMS, OR HARDWARE MALFUNCTIONS) HOWEVER CAUSED AND UNDER ANY THEORY OF LIABILITY, ARISING IN ANY WAY OUT OF THE USE OF OR INABILITY TO USE THIS SOFTWARE.',
  },
  {
    id: 8,
    title: '8. Privacy & Data Handling',
    content:
      'Inpand Torrent is built with a privacy-by-design architecture. The Software does NOT collect, track, store, analyze, transmit, or monetize your search history, download history, file names, info-hashes, device identifiers, or personal data to any centralized server. However, by the inherent decentralized design of the BitTorrent protocol, your IP address is publicly broadcast to peers in the swarm and publicly announced to trackers and DHT nodes to facilitate peer-to-peer data transfers.',
  },
  {
    id: 9,
    title: '9. Network & Bandwidth Usage',
    content:
      'BitTorrent transfers utilize significant network bandwidth and may result in substantial data consumption. You acknowledge that using the Software on cellular, metered, or mobile data networks may incur substantial charges from your carrier. Furthermore, sustained high-bandwidth peer transfers, cryptographic hash verification, and disk I/O will consume battery power and may cause device warming. You are solely responsible for monitoring your data caps and network settings.',
  },
  {
    id: 10,
    title: '10. Third-Party Content & Trackers',
    content:
      'Inpand Torrent may interact with third-party trackers, Distributed Hash Tables (DHT), Peer Exchange (PEX), and Local Service Discovery (LSD) swarms. We do not endorse, guarantee, or assume liability for any third-party website, tracker, peer node, search aggregator, or content encountered while using the BitTorrent protocol. Access to third-party swarms is conducted entirely at your own risk.',
  },
  {
    id: 11,
    title: '11. Storage & File Access Permissions',
    content:
      'In order to function as a file transfer client, the Software requires access to device storage to read, write, resume, and store downloaded files. You grant the Application permission to allocate, modify, and delete files strictly within your designated download directory. You acknowledge that deleting a torrent with file removal will permanently delete those files from your storage device.',
  },
  {
    id: 12,
    title: '12. Open Source Components & Third-Party Licenses',
    content:
      'Inpand Torrent incorporates open-source libraries and components, including libtorrent (rasterbar), React Native, Expo, SQLite, OpenSSL, and Boost. Each open-source component is licensed under its respective permissive or copyleft license (such as BSD-3-Clause, MIT, Apache 2.0, or Boost Software License). Complete license texts are accessible directly within the application under Settings > Open Source Licenses.',
  },
  {
    id: 13,
    title: '13. Age Restrictions / Minimum Age',
    content:
      'The Software is intended solely for individuals who are at least 13 years of age (or the minimum legal age of digital consent in your jurisdiction, whichever is greater). If you are under this legal age, you may only use Inpand Torrent under the direct supervision and with the consent of a parent or legal guardian who agrees to be bound by these Terms.',
  },
  {
    id: 14,
    title: '14. Export Controls & Compliance',
    content:
      'The Software contains cryptographic software algorithms. You represent and warrant that you are not located in, under the control of, or a national or resident of any country or region subject to applicable sanctions or export control restrictions, and that you will not use the Software in violation of any trade embargoes, sanctions, or export regulations.',
  },
  {
    id: 15,
    title: '15. Termination of Access',
    content:
      'These Terms remain in effect until terminated. Your rights under these Terms will terminate automatically without notice if you fail to comply with any provision. Upon termination, you must cease all use of the Software and permanently delete all copies of the Application from your devices.',
  },
  {
    id: 16,
    title: '16. Modifications to Terms',
    content:
      'We reserve the right, at our sole discretion, to modify or update these Terms at any time. When substantial or material changes occur, the Application will prompt you to review and accept the revised version upon launching the Software. Your continued use of the Software following any update constitutes your acceptance of the revised Terms.',
  },
  {
    id: 17,
    title: '17. Governing Law & Dispute Resolution',
    content:
      'To the fullest extent permitted by applicable law, these Terms shall be governed by and construed in accordance with the substantive laws of your jurisdiction without giving effect to conflicts of law principles. Any dispute arising from or related to the Software shall be resolved through good-faith negotiation or competent judicial arbitration.',
  },
  {
    id: 18,
    title: '18. Contact & Support Information',
    content:
      'If you have questions, inquiries, legal notices, or feedback regarding these Terms & Conditions or the operation of Inpand Torrent, please refer to the official repository and developer documentation: https://github.com/torrentflow-mobile (or support@inpandtorrent.app).',
  },
];

