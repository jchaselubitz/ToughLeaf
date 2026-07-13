# Section 1 - Understanding the Problem

### Initial Questions

10 high-level questions is too many, and 10 specific, detail questions is too few. When approaching a new domain, I start with question areas:

1. What are the regular, process-related tasks, ranked in order of time spent?
2. What regular tasks does the staff hate most?
3. What software tools are used to perform these tasks, how accessible are they programmatically (e.g. API), and which does the team appear to use as the central control point for coordination?

When interviewing the client, I typically have them walk me through their current process, then interrogate them further when I detect opportunities pursue the first two lines of inquiry. Hints that I need to dive deeper include:

- signs that the client finds a particular step frustrating or overwhelming
- disagreements among the clients team about what is important or where the friction is
- visible excitement around a particular idea or solution
- I detect a divergence between the client's position and their interest (e.g. when the client describes a specific solution that reflects an underlying need that may not actually match the solution they are describing)

I sometimes conclude interviews by asking (4) how the process would look if they could just use magic to make it better. What if it were unconstrained by reality?

---

### Simulation
For the purposes of this exercise. I used ChatGPT to first research the relevant regulations, then to simulate a compliance officer.

Prompt: 

> I am developing software for this: https://www.toughleaf.com/products/clearcomply. Lets imagine I spend two weeks shadowing a compliance officer who is responsible. Review [legal-and-regulatory-framework.md](https://github.com/jchaselubitz/ToughLeaf/blob/main/Documentation/legal-and-regulatory-framework.md) then imagine yourself as being a senior compliance professional (you can do internet research to learn more about this). I shadow you for two weeks. What do I see?

**You can view the response here: [two-week-officer-shadow.md](https://github.com/jchaselubitz/ToughLeaf/blob/main/Simulations/two-week-officer-shadow.md)**

What stands out:

| Observation | Questions |
| --- | --- |
| I need to become more familiar with the domain vocabulary. For example, "exceptions" and "findings" are self-explanatory, but unexpected. | |
| A lot of the relevant data is highly structured. | How can I get access to it programmatically? Which data is sensitive and needs to be handled securely? |
| Much of the communication work seems repetitive and likely unpleasant. | What are the common questions that subcontractors ask? What information is required to provide the answers? |
| A lot of information recorded (trade, scope, contract value, tier, certification, issuing body, expiration date, etc.) seem likely to be present somewhere programmatically reachable, either by some kind of direct data transfer from the client, or via a form or chatbot interface. | Who has each piece of information, and at which step in the process? |
| Status updates and tracking down information both appear to be key parts of the process. | How much manual work currently goes into keeping track of what information is missing? Where would be the best place, and what would be the best time, to surface that information automatically? |

**Note:** I am realizing that this ChatGPT simulation exercise is a great way to get my bearings before shadowing the client. In the future, I will probably spend a few days on this first. 

### Data Collection
Based on the observations from the simulation, I expect to need to collect the following data:
* A full list of datapoints compliance officers collect on subcontractors.
* A list of external sources of data that compliance officers use to verify the accuracy of the information they collect.
* An inventory of the data currently being tracked by the client, and where it is stored.
* A review of which information tends to be missing or incomplete.
* Some representation of the current process for tracking and updating the data (format depending on the situation).
* Who I can text when I have questions.

### Defining Success

**Quantitative:**
* Current time estimate for each process -> measured reduction thereof, with a particular focus on the steps that the client hates most.
* Percentage of subcontractors that are compliant -> measured increase thereof.
* Median time to complete a compliance review -> measured in percentage reduction thereof.

**Qualitative:**
* Does the client feel a greater sense of control over the process?
* Does the client feel more comfortable increasing the number of subcontractors they work with without increasing headcount?
* Is the client eager to automate more of the process?

### Risks
* The success of an automation process is closely tied to the degree to which the client can and must trust the software's output. I would want to get a sense of where mistakes are tolerable and where they are not, and try to fully automate the former, while focusing on narrowing the human scope of the latter. 
* Data security. This just has to be managed according to best practices.
* Poorly-designed automation may create more (or just more tedious) work for the client, rather than less. I would want to clearly document the human portion of any new process and measure that against the current process. 


# Section 2 - Prioritization Exercise

I am extremely hesitant to offer a confident answer without going through the process described above, but whatever, YOLO. Let's do this.

The goal will be to optimize for two objectives: 
1. maximize the visibility of the impact on the client
2. bring foundational steps forward, and delay features that may rely on those steps. 

#### 1. Automatic detection of missing information from uploaded files
Reasoning: This is both foundational and can easily be made visible with minimal development. We could either add a simple widget to a existing dashboard or set up an email notification that infors the officer that files have been uploaded with a list of which documents appear to be missing. 
#### 2. Automated document reminders for subcontractors
Reasoning: This automation offers a clear, measurable reduction in manual work. Priority 1 let's us work out the bugs before releasing ths, and in doing so, build confidence that it will work correctly.
#### 3. Dashboard redesign
Reasoning: At this stage, we should at least expect that we have basic accurate data on which subcontractors are compliant have submitted which documents, which gives us something to build the dashboard around. It's also very visible to the client.
#### 4. Realtime project reporting dashboard
Reasoning: I would want to hold off on this until we have clarity on which data is arriving from where. In any case, we would want to build it after Priority 3 so that we have surface on which to iterate with the client. 
#### 5. AI Chatbot (for subcontractors)
Reasoning: This will create a lot of value, but only once the client can be confident that the data will be accurate and that the chatbot's answers won't create more confusion. It seems likely to me that the realtime dashboard will present much of the same information that we use to ground the chatbot, so building it after Priority 4 should help build trust.
#### 6. Mobile app for subcontractors
Reasoning: I would be highly resistant to building this before we have demonstrated that it will offer value to subcontractors. Native apps introduce a lot of maintenance overhead, and many users are hesitant to download them in the first place. This investment only makes sense if the offering can take advantage of the unique affordance of mobile devices (e.g. always-on location, notifications, etc.).

# Sections 3 & 4 - Workflow Design Challenge

