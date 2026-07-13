# Section 1 - Understanding the Problem

### Initial Questions

10 is too many high-level questions, and 10 specific, detailed questions are too few. When approaching a new domain, I start with question areas:

1. What are the regular, process-related tasks, ranked in order of time spent?
2. What regular tasks does the staff hate most?
3. What software tools are used to perform these tasks, how accessible are they programmatically (e.g. API), and which does the team appear to use as the central control point for coordination?

When interviewing the client, I typically have them walk me through their current process, then interrogate them further when I detect opportunities to pursue the first two lines of inquiry. Hints that I need to dive deeper include:

- signs that the client finds a particular step frustrating or overwhelming
- disagreements among the client's team about what is important or where the friction is
- visible excitement around a particular idea or solution
- I detect a divergence between the client's position and their interest (e.g. when the client describes a specific solution that reflects an underlying need that may not actually match the solution they are describing)

I sometimes conclude interviews by asking how the process would look if they could just use magic to make it better. What if it were unconstrained by reality?

---



### Simulation

For the purposes of this exercise, I used ChatGPT to first research the relevant regulations, then to simulate a compliance officer.

Prompt: 

> I am developing software for this: [https://www.toughleaf.com/products/clearcomply](https://www.toughleaf.com/products/clearcomply). Let's imagine I spend two weeks shadowing a compliance officer who is responsible. Review [legal-and-regulatory-framework.md](https://github.com/jchaselubitz/ToughLeaf/blob/main/Documentation/legal-and-regulatory-framework.md) then imagine yourself as being a senior compliance professional (you can do internet research to learn more about this). I shadow you for two weeks. What do I see?

**You can view the response here: [two-week-officer-shadow.md](https://github.com/jchaselubitz/ToughLeaf/blob/main/Simulations/two-week-officer-shadow.md)**

What stands out:


| Observation                                                                                                                                                                                                                                                                             | Questions                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I need to become more familiar with the domain vocabulary. For example, "exceptions" and "findings" are self-explanatory, but unexpected here.                                                                                                                                               |                                                                                                                                                                                                   |
| A lot of the relevant data is highly structured.                                                                                                                                                                                                                                        | How can I get access to it programmatically? Which data is sensitive and needs to be handled securely?                                                                                            |
| Much of the communication work seems repetitive and likely unpleasant.                                                                                                                                                                                                                  | What are the common questions that subcontractors ask? What information is required to provide the answers?                                                                                       |
| A lot of information recorded (trade, scope, contract value, tier, certification, issuing body, expiration date, etc.) seems likely to be present somewhere programmatically reachable, either by some kind of direct data transfer from the client, or via a form or chatbot interface. | Who has each piece of information, and at which step in the process?                                                                                                                              |
| Status updates and tracking down information both appear to be key parts of the process.                                                                                                                                                                                                | How much manual work currently goes into keeping track of what information is missing? Where would be the best place, and what would be the best time, to surface that information automatically? |


**Note:** I am realizing that this ChatGPT simulation exercise is a great way to get my bearings before shadowing the client. In the future, I will probably spend a few days on this first. 

### Data Collection

Based on the observations from the simulation, I expect to need to collect the following data:

- A full list of data points compliance officers collect on subcontractors.
- A list of external sources of data that compliance officers use to verify the accuracy of the information they collect.
- An inventory of the data currently being tracked by the client, and where it is stored.
- A review of which information tends to be missing or incomplete.
- Some representation of the current process for tracking and updating the data (format depending on the situation).
- Who I can text when I have questions.



### Defining Success

**Quantitative:**

- Current time estimate for each process -> measured reduction thereof, with a particular focus on the steps that the client hates most.
- Percentage of subcontractors that are compliant -> measured increase thereof.
- Median time to complete a compliance review -> measured as a percentage reduction thereof.

**Qualitative:**

- Does the client feel a greater sense of control over the process?
- Does the client feel more comfortable increasing the number of subcontractors they work with without increasing headcount?
- Is the client eager to automate more of the process?



### Risks

- The success of an automation process is closely tied to the degree to which the client can and must trust the software's output. I would want to get a sense of where mistakes are tolerable and where they are not, and try to fully automate the former, while focusing on narrowing the human scope of the latter. 
- Data security. This just has to be managed according to best practices.
- Poorly-designed automation may create more (or just more tedious) work for the client, rather than less. I would want to clearly document the human portion of any new process and measure that against the current process.



# Section 2 - Prioritization Exercise

I am extremely hesitant to offer a confident answer without going through the process described above, but whatever, YOLO. Let's do this.

The goal will be to optimize for two objectives: 

1. maximize the visibility of the impact on the client
2. bring foundational steps forward, and delay features that may rely on those steps.



#### 1. Automatic detection of missing information from uploaded files

Reasoning: This is both foundational and can easily be made visible with minimal development. We could either add a simple widget to an existing dashboard or set up an email notification that informs the officer that files have been uploaded with a list of which documents appear to be missing. 

#### 2. Automated document reminders for subcontractors

Reasoning: This automation offers a clear, measurable reduction in manual work. Priority 1 lets us work out the bugs before releasing this, and in doing so, build confidence that it will work correctly.

#### 3. Dashboard redesign

Reasoning: At this stage, we should at least expect that we have basic accurate data on which subcontractors are compliant and have submitted which documents, which gives us something to build the dashboard around. It's also very visible to the client.

#### 4. Real-time project reporting dashboard

Reasoning: I would want to hold off on this until we have clarity on which data is arriving from where. In any case, we would want to build it after Priority 3 so that we have a surface on which to iterate with the client. 

#### 5. AI Chatbot (for subcontractors)

Reasoning: This will create a lot of value, but only once the client can be confident that the data will be accurate and that the chatbot's answers won't create more confusion. It seems likely to me that the real-time dashboard will present much of the same information that we use to ground the chatbot, so building it after Priority 4 should help build trust.

#### 6. Mobile app for subcontractors

Reasoning: I would be highly resistant to building this before we have demonstrated that it will offer value to subcontractors. Native apps introduce a lot of maintenance overhead, and many users are hesitant to download them in the first place. This investment only makes sense if the offering can take advantage of the unique affordances of mobile devices (e.g. always-on location, notifications, etc.).

# Sections 3 & 4 - Workflow Design Challenge

I chose to combine these sections because they significantly overlap. I've responded to the Section 3 questions below, but view the demo video and hosted app to explore the details.

### 1. What happens when a subcontractor is added to a project?

1. The client adds a subcontractor to a project using the web app.
2. The web app sends an invitation email to the subcontractor.
3. The subcontractor clicks the link and arrives at a page focused entirely on uploading the correct documents. (I excluded authentication for this demo)
4. The subcontractor uploads the documents and clicks submit.
5. The backend sends the documents to an AI endpoint to be reviewed to see if requirements are met.
6. The documents and the associated AI report appear in the client's dashboard.



### 2. What notifications should be sent?

- An initial invitation to upload the documents. 
- An email when the client marks the subcontractor's documents as incomplete.
- Any time that a document has been requested, but not submitted, for a period of one week, then every three days thereafter (I just made this pattern up. Would be configurable by the client.)



### 3. What should happen when required documents are missing?

- First, the subcontractor portal should, by its interface, make it obvious which documents are required.
- Second, the system should help the client identify not only which documents are missing, but also which documents are incomplete, and should give the client a one-click way to request the missing documents.
- Third, the system should offer configurable notifications that automatically pester the subcontractor until the documents are submitted.
- Fourth, the dashboard should make it clear which subcontractors have not yet submitted the required documents, and the number of days since the last reminder. Subcontractors more than 14 days (configurable) overdue should be highlighted in red.



### 4. Where would you use AI?

The biggest opportunity to benefit from AI is in assessing the subcontractor's documents and providing the compliance officer with information that lets them assess those documents more quickly. In the demo web app, I used Gemini (good balance of cost and accuracy) to look for the presence of information required for compliance. The same infrastructure could be used to:

1. Extract information from the documents to populate structured data about the subcontractor.
2. To assess various data points beyond just presence. For example, it could indicate whether a certificate is expired or not, or whether there are inconsistencies in the information provided.
3. By combining the first two features, the system could also check for consistency across the provided documents, and flag any issues to the compliance officer.



### 5. Where would you avoid using AI?

Anywhere I can. If the task can be accomplished deterministically, then deterministic code is better. Additionally, I'd hesitate to rely entirely on a non-deterministic system to make decisions that have significant consequences.

### 6. What would the MVP include?

With the caveat that prioritization would be largely dependent on the client's feedback, I would ship the following:

1. Everything you see in the hosted app.
2. Authentication with Role-Based Access Control (RBAC)
3. Deeper notification content and timing customization
4. More ways to specify what the document analysis AI should look for and how best to present the results.


### 7. What would come after the MVP?

Again, this would depend on identifying the smallest features that provide the most value. If the primary issue is that subcontractors are not providing the required documents, I would focus more on software that both reminds subcontractors, makes submission easier, and offers more tools to compliance professionals who need to pester the subcontractors. If instead the issue is that subcontractors are providing incomplete or insufficient documents, I would look for ways to push the initial document assessment out towards the subcontractor interface, so they could get immediate feedback on what they need to fix.

### Demo Webapp

The demo webapp is hosted at [https://tl-challenge-web-dev.railway.app/](https://tl-challenge-web-dev.railway.app/).

Some important notes:
1. Most of the features are fully functional (including email notifications and document analysis).
2. Just to be clear, I hand-coded very little of it. What you see is a result of thorough planning with Claude's help. And then sequential prompt execution via Overlord (using Claude, Codex, and Cursor).
3. I of course specified all of the the interface features, but some of the fit and finish (like the sidebar, colors, corner radius, etc.) is a design library called Shadcn.



[]

# Stack
 
 ### Tools used
 * Overlord - A tool I created for managing large numbers of prompts and agents as the build software. 
 * Claude - I worked out features and architecture with Claude Fable 5 before beginning work. The goal was to define a scope that was useful but limited opportunity for edge cases. Opus 4.8 build portions of the system.
 * Codex - 5.6 Terra build large portions of the system, with 5.6 Sol, doing the final review for the first complete version. 
 * Cursor - I did some cleanup with Cursor Auto. I also use it as my IDE.

 ### Infrastructure
 * Railway - Hosting.
 * Docker - Containerization.
 * Postgres - Database.
 * Minio - Object storage.
 * Resend - Email notifications.
 * Gemini - AI processing.

### Libraries
* React - Frontend.
* Tailwind - CSS.
* Shadcn - UI components.
* Drizzle - Database ORM.
* Zod - Validation.
* Tanstack Query - Data fetching.
* Tanstack Table - Table components.
* Hono - API framework.
* Vite - Build tool.