# bax-assistent

De Bax Assistent is een interne chatbot die gebruik maakt van een vector store die via DataBricks wordt aangeroepen. 

De chatbot is gemaakt in n8n. De UI wordt ook geserveerd via n8n, via verschillende webhook nodes. Iedere module in de repo wordt via een aparte webhook geserveerd om zo de code modulair te houden. 

Deze manier van serveren heeft als nadeel dat de app in een sandbox werkt. Daardoor kan bijvoorbeeld geen gebruik gemaakt worden van de local storage van de browser. Om sessies persistent te houden werken we met sessie tokens. Deze tokens worden door n8n uitgegeven en gevalideerd. 