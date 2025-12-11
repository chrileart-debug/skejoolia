import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Logo */}
        <div className="flex items-center justify-center font-extrabold tracking-tighter select-none text-3xl md:text-4xl mb-8 text-foreground">
          <span>S</span>
          <span>K</span>
          <span>E</span>
          <span>J</span>
          <span className="text-primary inline-flex items-center justify-center mx-[2px] hover:rotate-180 transition-transform duration-700 ease-in-out">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 6v6l4 2"></path>
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
          </span>
          <span>O</span>
          <span>L</span>
        </div>

        <div className="flex items-center justify-center gap-3 mb-8">
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Termos de Uso</h1>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <p className="text-muted-foreground text-lg">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>

          <section>
            <h2 className="text-xl font-semibold mb-4">1. Aceitação dos Termos</h2>
            <p className="text-muted-foreground">
              Ao acessar e utilizar a plataforma SKEJOOL, você concorda com estes Termos de Uso. 
              Se você não concordar com qualquer parte destes termos, não utilize nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Descrição do Serviço</h2>
            <p className="text-muted-foreground">
              A SKEJOOL é uma plataforma de gestão e agendamento que oferece:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
              <li>Sistema de agendamento online</li>
              <li>Gestão de clientes e serviços</li>
              <li>Integração com WhatsApp para atendimento automatizado</li>
              <li>Agentes de IA para atendimento ao cliente</li>
              <li>Dashboard de métricas e relatórios</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Cadastro e Conta</h2>
            <p className="text-muted-foreground">
              Para utilizar a SKEJOOL, você deve criar uma conta fornecendo informações precisas 
              e completas. Você é responsável por manter a confidencialidade de suas credenciais 
              e por todas as atividades realizadas em sua conta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Planos e Pagamentos</h2>
            <p className="text-muted-foreground mb-3">
              Oferecemos diferentes planos de assinatura:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Período de teste:</strong> 7 dias gratuitos em qualquer plano</li>
              <li><strong>Plano Básico:</strong> R$ 29,90/mês com funcionalidades essenciais</li>
              <li><strong>Plano Corporativo:</strong> R$ 49,90/mês com recursos avançados</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Os pagamentos são processados mensalmente. Você pode cancelar a qualquer momento, 
              mantendo acesso até o fim do período pago.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Uso Aceitável</h2>
            <p className="text-muted-foreground mb-3">Você concorda em não:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Violar leis ou regulamentos aplicáveis</li>
              <li>Usar o serviço para spam ou mensagens não solicitadas</li>
              <li>Tentar acessar contas de outros usuários</li>
              <li>Interferir no funcionamento normal da plataforma</li>
              <li>Revender ou redistribuir o serviço sem autorização</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Propriedade Intelectual</h2>
            <p className="text-muted-foreground">
              Todo o conteúdo da plataforma SKEJOOL, incluindo software, design, textos e logotipos, 
              é de propriedade exclusiva da SKEJOOL e protegido por leis de propriedade intelectual. 
              Você mantém a propriedade dos dados que insere na plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Limitação de Responsabilidade</h2>
            <p className="text-muted-foreground">
              A SKEJOOL não se responsabiliza por danos indiretos, incidentais ou consequenciais 
              decorrentes do uso ou impossibilidade de uso do serviço. Nosso serviço é fornecido 
              "como está", sem garantias de qualquer tipo além das expressamente declaradas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Cancelamento e Encerramento</h2>
            <p className="text-muted-foreground">
              Você pode cancelar sua conta a qualquer momento. Reservamo-nos o direito de suspender 
              ou encerrar contas que violem estes termos. Após o encerramento, seus dados serão 
              tratados conforme nossa Política de Privacidade.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Alterações nos Termos</h2>
            <p className="text-muted-foreground">
              Podemos atualizar estes termos periodicamente. Notificaremos sobre mudanças 
              significativas por email ou através da plataforma. O uso continuado após as 
              alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Contato</h2>
            <p className="text-muted-foreground">
              Para dúvidas sobre estes termos, entre em contato:{" "}
              <a href="mailto:contato@skejool.com" className="text-primary hover:underline">
                contato@skejool.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">11. Foro</h2>
            <p className="text-muted-foreground">
              Estes termos são regidos pelas leis do Brasil. Qualquer disputa será resolvida 
              no foro da comarca de São Paulo, SP.
            </p>
          </section>
        </div>

        {/* Back Link */}
        <div className="mt-12 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Terms;
