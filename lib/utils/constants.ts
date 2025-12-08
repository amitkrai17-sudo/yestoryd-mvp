/**
 * Application Constants
 */

// Services offered by Yestoryd
export const SERVICES = {
  COACHING: {
    id: 'coaching',
    name: 'Personalized Coaching',
    description: '1-on-1 reading sessions with expert coaches',
    icon: '👨‍🏫',
    color: 'blue',
  },
  ELEARNING: {
    id: 'elearning',
    name: 'eLearning Library',
    description: 'Video courses and self-paced learning modules',
    icon: '🎥',
    color: 'purple',
  },
  STORYTELLING: {
    id: 'storytelling',
    name: 'Storytelling Sessions',
    description: 'Live interactive storytelling for kids',
    icon: '📖',
    color: 'orange',
  },
  PODCASTS: {
    id: 'podcasts',
    name: 'Podcasts',
    description: 'Expert tips and reading insights for parents',
    icon: '🎧',
    color: 'green',
  },
  PHYSICAL_CLASSES: {
    id: 'physical-classes',
    name: 'Physical Classes',
    description: 'In-person workshops and group sessions',
    icon: '🏫',
    color: 'red',
  },
} as const;

// Pricing for non-coaching clients
export const SERVICE_PRICING = {
  elearning: { monthly: 999, quarterly: 2499 },
  storytelling: { monthly: 799, quarterly: 1999 },
  podcasts: { monthly: 0, quarterly: 0 }, // Free
  'physical-classes': { monthly: 4999, quarterly: 12999 },
} as const;

// Age-appropriate passages for reading assessment
export const READING_PASSAGES: Record<number, string[]> = {
  4: [
    "The cat sat on the mat. It was a red mat. The cat was black. The cat liked the mat. It was soft and warm. The cat went to sleep.",
    "I see a ball. The ball is big. The ball is red. I can kick the ball. The ball goes far. I run to the ball.",
    "The sun is up. The sun is hot. I play in the sun. I run and jump. The sun makes me happy. I love sunny days.",
  ],
  5: [
    "My dog is brown. His name is Max. Max likes to run. He runs very fast. Max plays in the park. He jumps and barks. I love my dog Max. He is my best friend.",
    "I go to school. My school is big. I have many friends. We read books together. We play at lunch time. School is so much fun. I learn new things every day.",
    "Look at the garden. The flowers are pretty. Some are red. Some are yellow. A butterfly sits on a flower. The garden smells nice. I water the plants every day.",
  ],
  6: [
    "One sunny day, Mia went to the beach with her family. The sand was warm under her feet. She built a big sandcastle with her brother. They found pretty shells near the water. The waves made a soft splashing sound. It was a perfect day at the beach.",
    "Tom has a little kitten named Whiskers. The kitten has soft gray fur. Whiskers likes to play with yarn. She chases it around the room. Sometimes she hides under the bed. Tom feeds her milk every morning. Whiskers purrs when she is happy.",
    "The rain started falling in the morning. Lily watched from her window. She saw puddles forming on the ground. When the rain stopped, she put on her boots. She splashed in every puddle she could find. Rainbow colors appeared in the sky. It was the most beautiful rainbow she had ever seen.",
  ],
  7: [
    "Last weekend, my family went camping in the forest. We set up our tent near a small stream. At night, we sat around the campfire and told stories. I heard owls hooting in the trees. The stars looked so bright without city lights. We roasted marshmallows and made s'mores. It was an adventure I will always remember.",
    "Maya loved doing science experiments at home. Today she decided to make a volcano. She used baking soda and vinegar for the eruption. When she mixed them together, bubbles shot up like real lava. Her little brother watched with amazement. Maya explained how the chemical reaction worked. She dreams of becoming a scientist one day.",
    "Every Saturday, Ben helps his grandfather in the garden. They plant vegetables like tomatoes and carrots. Grandpa teaches him how to water the plants properly. Ben learned that plants need sunlight to grow. After gardening, they drink lemonade on the porch. Ben loves spending time with his grandfather. The vegetables they grow taste better than store-bought ones.",
  ],
  8: [
    "Swimming lessons started this summer at the community pool. At first, I was nervous about putting my face underwater. My instructor was patient and taught me to blow bubbles. After two weeks, I could swim across the shallow end. By the end of summer, I earned my intermediate swimmer badge. Now I can dive off the low diving board. I'm so proud of how much I've improved.",
    "The annual book fair at school is my favorite event. This year, they had so many amazing books to choose from. I saved my allowance for three weeks to buy two chapter books. One was about a young detective who solves mysteries in her neighborhood. The other was a fantasy adventure with dragons and magic. Reading transports me to different worlds. I finished both books in one week.",
    "Autumn is a magical season in our neighborhood. The leaves change from green to brilliant shades of red, orange, and gold. My friends and I rake leaves into huge piles and then jump in them. We collect the most beautiful leaves for our art projects. The air smells like cinnamon from the bakery down the street. Sometimes we drink hot apple cider while watching the sunset. These simple moments make autumn special.",
  ],
  9: [
    "Our family took a road trip across three states last summer. We visited national parks, museums, and historical landmarks. The Grand Canyon was the most breathtaking sight I've ever witnessed. Standing at the rim, I felt small compared to nature's vastness. We hiked along trails and learned about the canyon's formation over millions of years. Each state had its own unique culture and cuisine. The memories from this journey will stay with me forever.",
    "Learning to play the guitar has been challenging but rewarding. My fingers hurt at first from pressing the strings. Practice sessions felt frustrating when I couldn't get chords right. But my teacher encouraged me to keep trying every day. After three months, I could play my first complete song. The feeling of accomplishment was incredible. Now I practice for an hour daily and can play ten different songs.",
    "Recycling and protecting the environment has become important to our school. We started a campaign to reduce plastic waste in our cafeteria. Students now bring reusable water bottles and lunch containers. We calculated that we've prevented hundreds of plastic bottles from going to landfills. Our class also planted trees in the schoolyard to help clean the air. Small actions by many people can create significant positive change. Every person can make a difference for our planet.",
  ],
  10: [
    "Artificial intelligence is transforming how we live and learn in remarkable ways. Virtual assistants help us find information and manage our daily schedules. AI programs can now recognize faces, translate languages, and even drive cars. In schools, adaptive learning software adjusts lessons to each student's pace. While this technology offers incredible benefits, it also raises important questions. We must consider privacy, job displacement, and ethical decision-making. Understanding AI helps us become responsible digital citizens.",
    "The Amazon rainforest is often called the lungs of our planet. This vast ecosystem produces twenty percent of the world's oxygen. It is home to over ten million species of plants and animals. Indigenous communities have lived in harmony with this forest for thousands of years. Unfortunately, deforestation threatens this irreplaceable treasure every day. Scientists warn that losing the rainforest could accelerate climate change dramatically. Conservation efforts require global cooperation and commitment from everyone.",
    "The human brain is the most complex organ in our body. It contains approximately eighty-six billion neurons that communicate through electrical signals. Our brain controls everything from breathing and heartbeat to thoughts and emotions. Scientists have discovered that the brain can change and adapt throughout our lives. This ability, called neuroplasticity, means we can always learn new skills. Healthy habits like sleep, exercise, and reading strengthen brain connections. Taking care of our brain is essential for a fulfilling life.",
  ],
  11: [
    "The Industrial Revolution fundamentally transformed human society and civilization. Beginning in Britain during the late eighteenth century, it spread across Europe and North America. Factories replaced cottage industries, and steam power revolutionized transportation. While productivity increased dramatically, working conditions were often harsh and dangerous. Child labor was common, and pollution became a serious problem in cities. Social reformers eventually fought for better labor laws and regulations. This period demonstrates how technological progress must be balanced with human welfare.",
    "Photosynthesis is the remarkable process by which plants convert sunlight into energy. Chlorophyll in plant cells absorbs light and uses it to transform carbon dioxide and water into glucose. This process releases oxygen as a byproduct, which all animals depend upon for survival. The intricate molecular machinery involved took billions of years to evolve. Scientists are now studying photosynthesis to develop more efficient solar energy technologies. Understanding this natural process could help address our growing energy needs. Nature often provides inspiration for human technological innovation.",
    "Democracy as a system of government originated in ancient Athens over two thousand years ago. Citizens participated directly in making laws and judicial decisions. However, this early democracy excluded women, slaves, and foreigners from participation. Modern democracies have evolved to include representative systems and broader voting rights. Democratic principles emphasize individual rights, rule of law, and governmental accountability. Yet democracy faces challenges from misinformation, polarization, and declining civic engagement. Protecting democratic institutions requires informed and active participation from citizens.",
  ],
  12: [
    "Climate change represents one of the most pressing challenges confronting humanity today. Global temperatures have risen significantly due to increased greenhouse gas emissions from human activities. The consequences include melting ice caps, rising sea levels, and more frequent extreme weather events. Scientists overwhelmingly agree that immediate action is necessary to prevent catastrophic outcomes. Renewable energy sources, sustainable practices, and international cooperation offer potential solutions. However, implementing these changes requires overcoming political, economic, and social obstacles. Each generation must consider its responsibility to future inhabitants of our planet.",
    "The Renaissance marked a profound cultural and intellectual rebirth in Europe. Beginning in Italy during the fourteenth century, it transformed art, science, and philosophy. Artists like Leonardo da Vinci and Michelangelo created masterpieces that still inspire us today. Humanist scholars rediscovered classical Greek and Roman texts, emphasizing human potential and achievement. The printing press enabled ideas to spread more rapidly than ever before. This period challenged medieval thinking and laid foundations for modern Western civilization. The Renaissance demonstrates how cultural movements can reshape entire societies.",
    "Quantum mechanics describes the bizarre behavior of matter at the atomic and subatomic level. Particles can exist in multiple states simultaneously until they are observed or measured. Einstein famously objected to this uncertainty, stating that God does not play dice with the universe. Despite its counterintuitive nature, quantum theory has proven extraordinarily accurate in predictions. Technologies like semiconductors, lasers, and MRI machines all depend on quantum principles. Scientists are now developing quantum computers that could revolutionize information processing. The quantum world challenges our everyday understanding of reality.",
  ],
  13: [
    "The ethical implications of artificial intelligence extend far beyond technical considerations. As AI systems become more sophisticated, questions arise about autonomy, accountability, and human dignity. Who bears responsibility when an autonomous vehicle causes an accident? How do we prevent algorithmic bias from perpetuating social inequalities? These dilemmas require input from philosophers, policymakers, technologists, and ordinary citizens. Developing ethical frameworks for AI must consider diverse cultural perspectives and values. Transparency in how algorithms make decisions is essential for maintaining public trust. The choices we make now will shape the relationship between humans and machines for generations.",
    "The human immune system represents an extraordinarily sophisticated defense mechanism. Billions of specialized cells work together to identify and neutralize foreign invaders. The innate immune system provides immediate, non-specific protection against pathogens. Adaptive immunity develops targeted responses and maintains immunological memory for future encounters. Vaccines leverage this memory system to provide protection without causing disease. Autoimmune disorders occur when the immune system mistakenly attacks the body's own tissues. Ongoing research into immunology continues to yield breakthrough treatments for various diseases.",
    "Digital democracy offers new possibilities for civic engagement and participation. Online platforms enable citizens to access information, communicate with representatives, and organize collective action. Social media has amplified voices that were previously marginalized in public discourse. However, digital spaces also present challenges including misinformation, echo chambers, and manipulation. Cybersecurity threats to electoral systems undermine confidence in democratic processes. The digital divide means some populations remain excluded from online civic participation. Navigating these complexities requires digital literacy and thoughtful platform governance.",
  ],
  14: [
    "Globalization has interconnected economies, cultures, and societies across the planet. International trade agreements facilitate the movement of goods, services, and capital across borders. Multinational corporations operate supply chains spanning multiple continents and countries. This integration has lifted millions from poverty while also creating new forms of inequality. Cultural exchange enriches societies but also raises concerns about homogenization and identity. Environmental challenges like climate change require unprecedented global coordination and cooperation. The COVID-19 pandemic demonstrated both the vulnerabilities and resilience of our interconnected world.",
    "Genetic engineering presents humanity with profound capabilities and responsibilities. Scientists can now modify DNA sequences to correct inherited diseases and enhance desired traits. CRISPR technology has made gene editing faster, cheaper, and more accessible than ever before. Agricultural applications have created crops resistant to pests, diseases, and environmental stresses. However, concerns about unintended consequences, ecological impacts, and equitable access remain significant. The possibility of editing human embryos raises fundamental questions about what it means to be human. Establishing appropriate ethical boundaries requires broad societal deliberation and consensus.",
    "The philosophy of consciousness examines the nature of subjective experience and awareness. What exactly is the relationship between physical brain processes and mental phenomena? This mind-body problem has puzzled philosophers and scientists for centuries. Materialists argue that consciousness is entirely explained by neural activity. Others propose that subjective experience cannot be reduced to physical descriptions alone. Advances in neuroscience provide new insights but have not resolved these fundamental questions. Understanding consciousness may ultimately require rethinking our basic assumptions about reality.",
  ],
  15: [
    "The intersection of biotechnology and ethics presents increasingly complex challenges for society. Advances in genetic engineering, synthetic biology, and neuroscience are expanding human capabilities in unprecedented ways. These technologies offer potential cures for genetic diseases and solutions to environmental challenges. However, they also raise profound questions about human enhancement, biodiversity, and the definition of life itself. The development of biological weapons and the risks of laboratory accidents demand robust governance frameworks. Ensuring equitable access to biotechnological benefits while preventing misuse requires international cooperation. As we acquire godlike powers to reshape life, we must develop wisdom commensurate with our capabilities.",
    "The philosophy of science examines the foundations, methods, and implications of scientific inquiry. What distinguishes scientific knowledge from other forms of understanding? How do theories evolve, and what criteria determine their acceptance or rejection? Thomas Kuhn's concept of paradigm shifts challenged the view of science as purely cumulative progress. Contemporary philosophers debate the extent to which scientific theories describe objective reality. The sociology of science reveals how social factors influence which research gets funded and published. Understanding the nature of science helps citizens evaluate scientific claims and participate in policy decisions.",
    "Global poverty remains one of the most persistent and challenging issues facing humanity. Despite significant progress in recent decades, hundreds of millions still lack adequate nutrition, healthcare, and education. The causes of poverty are multifaceted, including historical exploitation, institutional failures, and geographical disadvantages. Development economists debate the effectiveness of different interventions, from direct aid to market-based solutions. Climate change threatens to reverse gains and disproportionately impact the world's poorest populations. Addressing global poverty requires not only resources but also confronting structures of power and privilege. The persistence of extreme poverty in a world of abundance raises fundamental questions about justice and responsibility.",
  ],
};

// Default coach information
export const DEFAULT_COACH = {
  id: 'coach_001',
  name: 'Rucha Rai',
  email: 'rucha.rai@yestoryd.com',
  subdomain: 'rucha',
  specialization: 'Early Reading, Phonics, Fluency',
  ageGroups: '4-15',
  title: 'Founder & Head Reading Coach',
} as const;

// Session types
export const SESSION_TYPES = {
  FREE_CONSULTATION: {
    id: 'free-consultation',
    name: 'Free Consultation',
    duration: 30,
    price: 0,
  },
  COACHING_SESSION: {
    id: 'coaching-session',
    name: 'Coaching Session',
    duration: 60,
    price: 0, // Included in package
  },
} as const;

// Status values
export const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  CONFIRMED: 'confirmed',
} as const;
