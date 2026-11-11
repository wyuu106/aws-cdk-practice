import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export class AwsCdkPracticeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC（AWS内の仮想ネットワーク）
    const vpc = new ec2.Vpc(this, 'PracticeVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // EC2インスタンス
    const instance = new ec2.Instance(this, 'PracticeEc2', {
      vpc,
      // 指定しないとprivateサブネットが優先されるので、publicに固定する
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType('t3.micro'),
      machineImage: ec2.MachineImage.genericLinux({
        'ap-southeast-2': 'ami-0fe72ee76eb56783b',
      }),
    });

    // Session Managerで接続するための権限
    instance.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'AmazonSSMManagedInstanceCore'
      )
    );

    // 自分のグローバルIPからだけ8000番ポートへのアクセスを許可
    instance.connections.allowFrom(
      ec2.Peer.ipv4('126.55.240.211/32'),
      ec2.Port.tcp(8000),
      'Allow HTTP test from my IP'
    );

    // EC2のインスタンスIDを出力
    new cdk.CfnOutput(this, 'InstanceId', {
      value: instance.instanceId,
    });

    // RDS（PostgreSQL）
    const database = new rds.DatabaseInstance(this, 'PracticeDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_17,
      }),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MICRO
      ),
      allocatedStorage: 20,
      multiAz: false,
      publiclyAccessible: false,
      databaseName: 'practice_db',
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
      deleteAutomatedBackups: true,
    });

    // EC2からRDSへのPostgreSQL通信を許可
    database.connections.allowDefaultPortFrom(instance);

    // DBの接続先をCloudFormationの出力に追加
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.dbInstanceEndpointAddress,
    });
  }
}
